// Leer variables de entorno desde window.ENV (inyectadas en index.html)

// Inicializar cliente de Supabase
let supabaseClient = null;
// Función para inicializar Supabase
function initializeSupabase() {
    // Asegurarse que tanto la librería de Supabase como la configuración estén disponibles
    if (typeof supabase !== 'undefined' && typeof window.ENV !== 'undefined') {
        supabaseClient = supabase.createClient(window.ENV.API_URL, window.ENV.API_KEY);
        console.log('Cliente de Supabase inicializado');
        return true;
    } else {
        if (typeof supabase === 'undefined') console.error('La librería de Supabase no está cargada.');
        if (typeof window.ENV === 'undefined') console.error('El archivo de configuración (config.js) no está cargado o no define window.ENV.');
        return false;
    }
}

// Funciones para la tabla 'jugadores'
const JugadoresDB = {
    // Crear un nuevo jugador
    async crear(nombre) {
        try {
            const { data, error } = await supabaseClient
                .from('jugadores')
                .insert([{ nombre: nombre }])
                .select();
            
            if (error) throw error;
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('Error al crear jugador:', error);
            return { success: false, error: error.message };
        }
    },

    // Obtener todos los jugadores
    async obtenerTodos() {
        try {
            const { data, error } = await supabaseClient
                .from('jugadores')
                .select('*')
                .order('nombre');
            
            if (error) throw error;
            return { success: true, data: data };
        } catch (error) {
            console.error('Error al obtener jugadores:', error);
            return { success: false, error: error.message };
        }
    },

    // Buscar jugador por nombre
    async buscarPorNombre(nombre) {
        try {
            const { data, error } = await supabaseClient
                .from('jugadores')
                .select('*')
                .eq('nombre', nombre)
                .single();
            
            if (error && error.code !== 'PGRST116') throw error;
            return { success: true, data: data };
        } catch (error) {
            console.error('Error al buscar jugador:', error);
            return { success: false, error: error.message };
        }
    },

    // Eliminar jugador
    async eliminar(id) {
        try {
            const { error } = await supabaseClient
                .from('jugadores')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error al eliminar jugador:', error);
            return { success: false, error: error.message };
        }
    }
};

// Funciones para la tabla 'jugadas_polla'
const JugadasPollaDB = {
    // Crear una nueva jugada
    async crear(jugadaData) {
        try {
            const { data, error } = await supabaseClient
                .from('jugadas_polla')
                .insert(jugadaData) // Acepta un objeto o un array de objetos
                .select();
            if (error) throw error;
            return { success: true, data: data };
        } catch (error) {
            // Log a more descriptive error message
            console.error('Error al crear jugada en jugadas_polla:', error.message || error);
            return { success: false, error: error.message };
        }
    },

    // Obtener todas las jugadas
    async obtenerTodas() {
        try {
            const { data, error } = await supabaseClient
                .from('jugadas_polla')
                .select('*')
                .order('created_at');
            if (error) throw error;
            return { success: true, data: data };
        } catch (error) {
            console.error('Error al obtener jugadas de jugadas_polla:', error);
            return { success: false, error: error.message };
        }
    },

    // Eliminar una jugada por ID
    async eliminar(id) {
        try {
            const { error } = await supabaseClient
                .from('jugadas_polla')
                .delete()
                .eq('id', id);
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error al eliminar jugada de jugadas_polla:', error);
            return { success: false, error: error.message };
        }
    },

    // Eliminar todas las jugadas
    async deleteAll() {
        try {
            const { error } = await supabaseClient
                .from('jugadas_polla')
                .delete()
                .gt('id', 0); // Condición para borrar todo
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error al eliminar todas las jugadas de polla:', error);
            return { success: false, error: error.message };
        }
    },

    // Actualizar múltiples jugadas
    async actualizar(jugadasData) {
        try {
            const { data, error } = await supabaseClient
                .from('jugadas_polla')
                .upsert(jugadasData)
                .select();
            if (error) throw error;
            return { success: true, data: data };
        } catch (error) {
            console.error('Error al actualizar jugadas en jugadas_polla:', error);
            return { success: false, error: error.message };
        }
    },
};

// Funciones para la tabla 'jugadas_micro' (3 números)
const JugadasMicroDB = {
    // Crear una nueva jugada de 3 números
    async crear(jugadaData) {
        try {
            const { data, error } = await supabaseClient
                .from('jugadas_micro')
                .insert(jugadaData) // Acepta un objeto o un array de objetos
                .select();
            if (error) throw error;
            return { success: true, data: data };
        } catch (error) {
            console.error('Error al crear jugada en jugadas_micro:', error);
            return { success: false, error: error.message };
        }
    },

    // Obtener todas las jugadas de 3 números
    async obtenerTodas() {
        try {
            const { data, error } = await supabaseClient
                .from('jugadas_micro')
                .select('*')
                .order('created_at');
            if (error) throw error;
            return { success: true, data: data };
        } catch (error) {
            console.error('Error al obtener jugadas de jugadas_micro:', error);
            return { success: false, error: error.message };
        }
    },

    // Eliminar una jugada de 3 números por ID
    async eliminar(id) {
        try {
            const { error } = await supabaseClient
                .from('jugadas_micro')
                .delete()
                .eq('id', id);
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error al eliminar jugada de jugadas_micro:', error);
            return { success: false, error: error.message };
        }
    },

    // Eliminar todas las jugadas
    async deleteAll() {
        try {
            const { error } = await supabaseClient
                .from('jugadas_micro')
                .delete()
                .gt('id', 0); // Condición para borrar todo
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error al eliminar todas las jugadas de micro:', error);
            return { success: false, error: error.message };
        }
    },

    // Actualizar múltiples jugadas de 3 números
    async actualizar(jugadasData) {
        // Esta función no está implementada en el frontend
        console.warn('JugadasMicroDB.actualizar no está implementado en el frontend.');
        return { success: false, error: 'Función no implementada' };
    },
};

// Funciones para la tabla 'resultados_micro'
const ResultadosMicroDB = {
    // Crear un nuevo resultado
    async crear(numerosGanadoresArray) {
        try {
            const resultadoData = { numeros_ganadores: numerosGanadoresArray };
            const { data, error } = await supabaseClient
                .from('resultados_micro')
                .insert([resultadoData])
                .select();
            if (error) throw error;
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('Error al crear resultado de micro:', error);
            return { success: false, error: error.message };
        }
    },

    // Obtener el último resultado
    async obtenerUltimo() {
        try {
            const { data, error } = await supabaseClient
                .from('resultados_micro')
                .select('*')
                .order('fecha_sorteo', { ascending: false })
                .limit(1)
                .single();
            if (error && error.code !== 'PGRST116') throw error;
            return { success: true, data: data };
        } catch (error) {
            console.error('Error al obtener último resultado de micro:', error);
            return { success: false, error: error.message };
        }
    },

    // Eliminar el último resultado
    async eliminarUltimo() {
        try {
            const ultimo = await this.obtenerUltimo();
            if (ultimo.success && ultimo.data && ultimo.data.id) {
                const { error } = await supabaseClient
                    .from('resultados_micro')
                    .delete()
                    .eq('id', ultimo.data.id);
                if (error) throw error;
                return { success: true };
            } else {
                return { success: false, error: 'No hay resultado para eliminar' };
            }
        } catch (error) {
            console.error('Error al eliminar último resultado de micro:', error);
            return { success: false, error: error.message };
        }
    },

    // Eliminar todos los resultados
    async deleteAll() {
        try {
            const { error } = await supabaseClient
                .from('resultados_micro')
                .delete()
                .gt('id', 0);
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error al eliminar todos los resultados de micro:', error);
            return { success: false, error: error.message };
        }
    },
};

// Funciones para la tabla 'resultados_numeros'
const ResultadosNumerosDB = {
    // Crear un nuevo resultado
    async crear(numerosGanadoresArray) {
        try {
            // El array ya debe contener strings. La BD se encargará de la validación.
            const resultadoData = {
                numeros_ganadores: numerosGanadoresArray
            };
            const { data, error } = await supabaseClient
                .from('resultados_numeros')
                .insert([resultadoData])
                .select();
            if (error) throw error;
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('Error al crear resultado:', error);
            return { success: false, error: error.message };
        }
    },

    // Obtener el último resultado
    async obtenerUltimo() {
        try {
            const { data, error } = await supabaseClient
                .from('resultados_numeros')
                .select('*')
                .order('fecha_sorteo', { ascending: false })
                .limit(1)
                .single();
            if (error && error.code !== 'PGRST116') throw error;
            return { success: true, data: data };
        } catch (error) {
            console.error('Error al obtener último resultado:', error);
            return { success: false, error: error.message };
        }
    },

    // Eliminar el último resultado
    async eliminarUltimo() {
        try {
            // Obtener el último resultado
            const ultimo = await this.obtenerUltimo();
            if (ultimo.success && ultimo.data && ultimo.data.id) {
                const { error } = await supabaseClient
                    .from('resultados_numeros')
                    .delete()
                    .eq('id', ultimo.data.id);
                if (error) throw error;
                return { success: true };
            } else {
                return { success: false, error: 'No hay resultado para eliminar' };
            }
        } catch (error) {
            console.error('Error al eliminar último resultado:', error);
            return { success: false, error: error.message };
        }
    },

    // Eliminar todos los resultados
    async deleteAll() {
        try {
            const { error } = await supabaseClient
                .from('resultados_numeros')
                .delete()
                .gt('id', 0);
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error al eliminar todos los resultados de polla:', error);
            return { success: false, error: error.message };
        }
    },

    // Obtener resultados por fecha
    async obtenerPorFecha(fecha) {
        try {
            const { data, error } = await supabaseClient
                .from('resultados_numeros')
                .select('*')
                .gte('fecha_sorteo', fecha + 'T00:00:00')
                .lt('fecha_sorteo', fecha + 'T23:59:59')
                .order('fecha_sorteo', { ascending: false });
            
            if (error) throw error;
            return { success: true, data: data };
        } catch (error) {
            console.error('Error al obtener resultados por fecha:', error);
            return { success: false, error: error.message };
        }
    }
};

// Funciones para la tabla 'marcadores'
const MarcadoresDB = {
    // Crear o actualizar marcador del día
    async actualizarDia(fecha, valor) {
        try {
            const { data, error } = await supabaseClient
                .from('marcadores')
                .upsert([{ fecha: fecha, valor: valor }])
                .select();
            
            if (error) throw error;
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('Error al actualizar marcador:', error);
            return { success: false, error: error.message };
        }
    },

    // Obtener marcadores de la semana
    async obtenerSemana(fechaInicio, fechaFin) {
        try {
            const { data, error } = await supabaseClient
                .from('marcadores')
                .select('*')
                .gte('fecha', fechaInicio)
                .lte('fecha', fechaFin)
                .order('fecha');
            
            if (error) throw error;
            return { success: true, data: data };
        } catch (error) {
            console.error('Error al obtener marcadores de la semana:', error);
            return { success: false, error: error.message };
        }
    }
};

// Funciones para la tabla 'potes'
const PotesDB = {
    // Obtener el pote para un tipo de juego
    async obtener(tipoJuego) {
        try {
            const { data, error } = await supabaseClient
                .from('potes')
                .select('valores_diarios')
                .eq('tipo_juego', tipoJuego)
                .limit(1); // Use limit(1) to prevent errors if multiple rows exist
            
            if (error) throw error;
            // data is an array, get the first element's values if it exists
            return { success: true, data: (data && data.length > 0) ? data[0].valores_diarios : null };
        } catch (error) {
            console.error(`Error al obtener pote para ${tipoJuego}:`, error);
            return { success: false, error: error.message };
        }
    },

    // Actualizar o crear el pote para un tipo de juego
    async actualizar(tipoJuego, valoresDiarios) {
        try {
            const { data, error } = await supabaseClient
                .from('potes')
                .upsert({ tipo_juego: tipoJuego, valores_diarios: valoresDiarios }, {
                    onConflict: 'tipo_juego'
                })
                .select();
            
            if (error) throw error;
            return { success: true, data: data[0] };
        } catch (error) {
            console.error(`Error al actualizar pote para ${tipoJuego}:`, error);
            return { success: false, error: error.message };
        }
    }
    ,
    // Eliminar el pote para un tipo de juego específico
    async eliminar(tipoJuego) {
        try {
            const { error } = await supabaseClient
                .from('potes')
                .delete()
                .eq('tipo_juego', tipoJuego);
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error(`Error al eliminar pote para ${tipoJuego}:`, error);
            return { success: false, error: error.message };
        }
    }
};

// Función para resetear todos los datos del juego llamando a un RPC
async function resetAllGameData() {
    try {
        const { error } = await supabaseClient.rpc('reset_game_data');
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error al resetear los datos del juego:', error);
        return { success: false, error: error.message };
    }
}

// Exportar funciones para uso global
window.initializeSupabase = initializeSupabase;
window.JugadoresDB = JugadoresDB;
window.JugadasPollaDB = JugadasPollaDB;
window.JugadasMicroDB = JugadasMicroDB;
window.ResultadosMicroDB = ResultadosMicroDB;
window.ResultadosNumerosDB = ResultadosNumerosDB;
window.MarcadoresDB = MarcadoresDB;
window.PotesDB = PotesDB;
window.resetAllGameData = resetAllGameData;