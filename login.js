// login.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializar Supabase. Es crucial para que el login funcione.
    if (typeof initializeSupabase !== 'function' || !initializeSupabase()) {
        console.error("Fallo al inicializar Supabase. El login no funcionará.");
        const errorDiv = document.getElementById('errorMessage');
        errorDiv.textContent = 'Error de configuración. Contacte al administrador.';
        errorDiv.classList.remove('hidden');
        return;
    }

    const loginForm = document.getElementById('loginForm');
    const errorMessageDiv = document.getElementById('errorMessage');
    const loginButton = document.getElementById('loginButton');

    // 2. Manejar el envío del formulario de login.
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Deshabilitar el botón para evitar envíos múltiples.
        loginButton.disabled = true;
        loginButton.textContent = 'Ingresando...';
        errorMessageDiv.classList.add('hidden');

        const email = e.target.email.value;
        const password = e.target.password.value;

        // 3. Intentar iniciar sesión con Supabase Auth.
        const { error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            errorMessageDiv.textContent = 'Correo o contraseña incorrectos. Inténtalo de nuevo.';
            errorMessageDiv.classList.remove('hidden');
            loginButton.disabled = false;
            loginButton.textContent = 'Ingresar';
        } else {
            window.location.replace('index.html');
        }
    });
});