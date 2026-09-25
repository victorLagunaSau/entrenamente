"use client";

import * as React from "react";

import { FLOW_STEPS, SUBMIT_STEP } from "../lib/steps";
import { validateAccount, validateGoal, type FieldErrors } from "../lib/validation";
import * as service from "../services/registration-service";
import type { AccountData, ExtraData, Flow, GoalData, Invite, PlanId, Profile, StepId } from "../types";

type InviteState =
  | { status: "none" }
  | { status: "loading"; code: string }
  | { status: "invalid"; code: string }
  | { status: "valid"; invite: Invite };

type State = {
  flow: Flow | null;
  stepIndex: number;
  direction: 1 | -1;
  account: AccountData;
  goal: GoalData;
  extra: ExtraData;
  /** Campos que el usuario ya visitó: sus errores se muestran en línea. */
  touched: Partial<Record<keyof AccountData | keyof GoalData, boolean>>;
  /** Pasos donde se intentó avanzar: se muestran todos sus errores. */
  attempted: Partial<Record<StepId, boolean>>;
  busy: boolean;
  serverErrors: Partial<Record<keyof AccountData | "form", string>>;
  profile: Profile | null;
  invite: InviteState;
  /** Invitación creada por el padre en el Paso 4B. */
  createdInvite: Invite | null;
  checkoutPlan: PlanId | null;
};

type Action =
  | { type: "chooseFlow"; flow: Exclude<Flow, "invited"> }
  | { type: "go"; delta: 1 | -1 }
  | { type: "setAccount"; patch: Partial<AccountData> }
  | { type: "setGoal"; patch: Partial<GoalData> }
  | { type: "setExtra"; patch: Partial<ExtraData> }
  | { type: "touch"; field: keyof State["touched"] }
  | { type: "attempt"; step: StepId }
  | { type: "busy"; busy: boolean }
  | { type: "serverErrors"; errors: State["serverErrors"] }
  | { type: "registered"; profile: Profile; createdInvite?: Invite }
  | { type: "invite"; invite: InviteState }
  | { type: "checkout"; plan: PlanId | null };

const initialState: State = {
  flow: null,
  stepIndex: 0,
  direction: 1,
  account: { fullName: "", alias: "", email: "", password: "" },
  goal: { universityId: null, careerId: null },
  extra: { originSchool: "", notStudying: false },
  touched: {},
  attempted: {},
  busy: false,
  serverErrors: {},
  profile: null,
  invite: { status: "none" },
  createdInvite: null,
  checkoutPlan: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "chooseFlow":
      return { ...state, flow: action.flow };
    case "go":
      return { ...state, stepIndex: state.stepIndex + action.delta, direction: action.delta };
    case "setAccount": {
      // Al editar un campo se descarta su error del servidor (p. ej. correo ya registrado).
      const serverErrors = { ...state.serverErrors };
      for (const k of Object.keys(action.patch)) delete serverErrors[k as keyof AccountData];
      return { ...state, account: { ...state.account, ...action.patch }, serverErrors };
    }
    case "setGoal":
      return { ...state, goal: { ...state.goal, ...action.patch } };
    case "setExtra":
      return { ...state, extra: { ...state.extra, ...action.patch } };
    case "touch":
      return state.touched[action.field] ? state : { ...state, touched: { ...state.touched, [action.field]: true } };
    case "attempt":
      return { ...state, attempted: { ...state.attempted, [action.step]: true } };
    case "busy":
      return { ...state, busy: action.busy };
    case "serverErrors":
      return { ...state, serverErrors: action.errors };
    case "registered":
      return { ...state, profile: action.profile, createdInvite: action.createdInvite ?? null };
    case "invite": {
      const invite = action.invite;
      // Con invitación válida la meta viene definida por el padre.
      if (invite.status === "valid") return { ...state, invite, flow: "invited", goal: invite.invite.goal };
      return { ...state, invite };
    }
    case "checkout":
      return { ...state, checkoutPlan: action.plan };
  }
}

type Ctx = {
  state: State;
  steps: StepId[];
  step: StepId;
  /** Posición 1-based y total para "Paso X de Y" (la bienvenida no cuenta como paso). */
  position: { current: number; total: number };
  accountErrors: FieldErrors<AccountData>;
  goalErrors: FieldErrors<GoalData>;
  canContinue: boolean;
  /** Ya se creó la cuenta: no se puede regresar a pasos anteriores. */
  isLocked: boolean;
  dispatch: React.Dispatch<Action>;
  next: () => Promise<void>;
  back: () => void;
};

const RegistrationContext = React.createContext<Ctx | null>(null);

export function RegistrationProvider({
  inviteCode,
  children,
}: {
  inviteCode?: string | null;
  children: React.ReactNode;
}) {
  const [state, dispatch] = React.useReducer(reducer, initialState);

  React.useEffect(() => {
    if (!inviteCode) return;
    let cancelled = false;
    dispatch({ type: "invite", invite: { status: "loading", code: inviteCode } });
    service.getInvite(inviteCode).then((invite) => {
      if (cancelled) return;
      dispatch({
        type: "invite",
        invite: invite ? { status: "valid", invite } : { status: "invalid", code: inviteCode },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [inviteCode]);

  const steps = FLOW_STEPS[state.flow ?? "student"];
  const step = steps[Math.min(state.stepIndex, steps.length - 1)];
  const progressSteps = steps.filter((s): s is StepId => s !== "profile");
  const flow = state.flow ?? "student";

  const accountErrors = React.useMemo(() => validateAccount(state.account, flow), [state.account, flow]);
  const goalErrors = React.useMemo(() => validateGoal(state.goal), [state.goal]);

  const stepValid: Record<StepId, boolean> = {
    profile: state.flow !== null,
    name: !accountErrors.fullName && !accountErrors.alias,
    account: !accountErrors.email && !accountErrors.password,
    university: !goalErrors.universityId,
    career: !goalErrors.careerId,
    extra: true,
    success: true,
    invite: true,
  };

  const next = React.useCallback(async () => {
    if (state.busy) return;
    if (!stepValid[step]) {
      dispatch({ type: "attempt", step });
      return;
    }

    dispatch({ type: "busy", busy: true });
    dispatch({ type: "serverErrors", errors: {} });
    try {
      if (step === "account") {
        const available = await service.isEmailAvailable(state.account.email);
        if (!available) {
          dispatch({ type: "serverErrors", errors: { email: "Este correo ya tiene una cuenta. Inicia sesión." } });
          return;
        }
      }

      if (step === SUBMIT_STEP[flow]) {
        if (flow === "parent") {
          const { profile, invite } = await service.registerParent({ account: state.account, goal: state.goal });
          dispatch({ type: "registered", profile, createdInvite: invite });
        } else {
          const profile = await service.registerStudent({
            account: state.account,
            goal: state.goal,
            extra: state.extra,
            inviteCode: state.invite.status === "valid" ? state.invite.invite.code : undefined,
          });
          dispatch({ type: "registered", profile });
        }
      }

      dispatch({ type: "go", delta: 1 });
    } catch {
      dispatch({ type: "serverErrors", errors: { form: "No pudimos completar el registro. Intenta de nuevo." } });
    } finally {
      dispatch({ type: "busy", busy: false });
    }
    // stepValid se deriva del estado; incluirlo recrearía la función en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, step, flow]);

  const back = React.useCallback(() => {
    if (state.stepIndex > 0 && !state.busy) dispatch({ type: "go", delta: -1 });
  }, [state.stepIndex, state.busy]);

  const value: Ctx = {
    state,
    steps,
    step,
    position: { current: progressSteps.indexOf(step) + 1, total: progressSteps.length },
    accountErrors,
    goalErrors,
    canContinue: stepValid[step] && !state.busy,
    isLocked: state.profile !== null,
    dispatch,
    next,
    back,
  };

  return <RegistrationContext.Provider value={value}>{children}</RegistrationContext.Provider>;
}

export function useRegistration() {
  const ctx = React.useContext(RegistrationContext);
  if (!ctx) throw new Error("useRegistration debe usarse dentro de <RegistrationProvider>");
  return ctx;
}

/** Error visible de un campo: tras visitarlo, tras intentar avanzar, o si vino del servidor. */
export function useFieldError<T extends keyof AccountData | keyof GoalData>(
  field: T,
  errors: Partial<Record<T, string>>,
  step: StepId
) {
  const { state } = useRegistration();
  const server = field in state.serverErrors ? state.serverErrors[field as keyof AccountData] : undefined;
  const show = state.touched[field] || state.attempted[step];
  return server ?? (show ? errors[field] : undefined);
}
