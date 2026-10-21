/**
 * Con sesión, la landing manda directo al panel. Para que ocurra antes de que cargue React (en celulares lentos
 * tarda), el último panel resuelto se recuerda en localStorage junto con el id del usuario, y un script en línea
 * al inicio de la página redirige si el token de Supabase guardado es de ese mismo usuario.
 */

export const HOME_CACHE_KEY = "em:home";

/** Mientras se decide a dónde ir, la landing se oculta (ver globals.css) para no parpadear. */
export const REDIRECT_ATTR = "data-auth-redirect";

export function rememberHome(userId: string, path: string) {
  try {
    localStorage.setItem(HOME_CACHE_KEY, JSON.stringify({ id: userId, path }));
  } catch {}
}

export function forgetHome() {
  try {
    localStorage.removeItem(HOME_CACHE_KEY);
  } catch {}
}

/**
 * Script en línea de la landing. Sin panel recordado (o de otro usuario) solo oculta la página y deja que
 * `LandingSessionRedirect` resuelva el destino; a los 5 s la vuelve a mostrar por si algo falla.
 * `trailingSlash`: el export de Capacitor sirve las rutas como carpetas (/app/student/).
 */
export function landingRedirectScript(trailingSlash: boolean) {
  return `(function(){try{
var d=document.documentElement,t=null,i,k;
for(i=0;i<localStorage.length;i++){k=localStorage.key(i);if(/^sb-.+-auth-token$/.test(k)){t=JSON.parse(localStorage.getItem(k));break}}
if(!t||!t.refresh_token)return;
d.setAttribute("${REDIRECT_ATTR}","");
setTimeout(function(){d.removeAttribute("${REDIRECT_ATTR}")},5000);
var h=JSON.parse(localStorage.getItem("${HOME_CACHE_KEY}")||"null");
if(h&&t.user&&h.id===t.user.id&&/^\\/[^/]/.test(h.path)){location.replace(h.path${trailingSlash ? '.replace(/\\/?$/,"/")' : ""})}
}catch(e){}})();`;
}
