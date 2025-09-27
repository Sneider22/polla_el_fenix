// auth.js

/**
 * Verifica si el usuario está autenticado.
 * Esta función se autoejecuta al cargar el script en una página.
 * Si el usuario no tiene una sesión activa, lo redirige a la página de login.
 */
(async function checkAuth() {
    // 1. Asegurarse de que Supabase esté inicializado.
    // La función initializeSupabase() se encuentra en supabase-config.js
    if (typeof initializeSupabase !== 'function' || !initializeSupabase()) {
        console.error("Fallo al inicializar Supabase. La autenticación no funcionará.");
        // Muestra un error crítico en la página si Supabase no carga.
        document.body.innerHTML = '<div style="color: red; text-align: center; padding: 50px; font-size: 1.2rem;">Error de configuración. No se pudo conectar a la base de datos.</div>';
        return;
    }

    // 2. Obtener la sesión actual del usuario.
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        // Si no hay sesión, el usuario no está logueado.
        // Redirigir a la página de login.
        // Se usa 'login.html' como ruta relativa.
        window.location.replace('login.html');
    } else {
        // Si hay una sesión, el usuario está autenticado.
        console.log('Usuario autenticado:', session.user.email);
        // La página protegida puede continuar su carga normal.
    }
})();

/**
 * Cierra la sesión del usuario actual en Supabase.
 */
async function handleLogout() {
    if (!confirm('¿Estás seguro de que quieres cerrar sesión?')) return;

    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        console.error('Error al cerrar sesión:', error);
        alert('Error al cerrar sesión: ' + error.message);
    } else {
        window.location.replace('login.html');
    }
}