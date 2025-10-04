// Variables globales
let playsCount = 0;
let debounceTimer;
let winnersCount = 0;
let premioPorGanador = 0;
let prizesToDistribute = 0;
let winningNumbers = new Set(); // Números ganadores seleccionados para el juego actual
let pollaPlayers = []; // Array para jugadores de Polla
let microPlayers = []; // Array para jugadores de Micro
let playersDatabase = []; // Base de datos local de nombres de jugadores

// Cache para elementos del DOM
const domCache = {
    pollaTable: null,
    microTable: null,
    pollaTableBody: null,
    microTableBody: null,
    currentTableBody: null
};

// Configuración de rendimiento
const PERF_CONFIG = {
    debounceTime: 100, // ms para el debounce de actualizaciones
    batchUpdates: true, // Agrupar actualizaciones
    cacheDom: true, // Activar caché de elementos DOM
    lazyLoad: true // Carga perezosa de datos
};
// Celda donde se hizo click por última vez (punto de inicio para pegado desde Excel)
let lastClickedCell = null;
let dailyValues = {
    polla: { lunes: 0, martes: 0, miércoles: 0, jueves: 0, viernes: 0, sábado: 0, domingo: 0, garantizado: 0, acumulado: 0 },
    micro: { lunes: 0, martes: 0, miércoles: 0, jueves: 0, viernes: 0, sábado: 0, domingo: 0, garantizado: 0, acumulado: 0 }
};
let currentGameType = 'polla'; // 'polla' o 'micro'

// Inicialización cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    initializeGame();
    setupEventListeners();
    updateDisplay();
    
    // Botón para limpiar números ganadores
    const clearBtn = document.getElementById('clearWinningNumbers');
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            if (winningNumbers.size === 0) return; // No hay nada que limpiar
            if (!confirm(`¿Estás seguro de que quieres limpiar TODOS los números ganadores para ${currentGameType.toUpperCase()}?`)) return;

            // Limpiar UI
            document.querySelectorAll('.number-cell.selected').forEach(cell => {
                cell.classList.remove('selected', 'ring-yellow-400', 'transform', 'scale-110', 'bg-yellow-300', 'text-black');
            });

            // Limpiar en memoria
            winningNumbers.clear();

            // Actualizar en la base de datos
            await updateWinningNumbersInDB();
        });
    }
});

// Helper para obtener el cuerpo de la tabla actual
function getCurrentTableBody() {
    const tableId = currentGameType === 'polla' ? 'pollaTableBody' : 'microTableBody';
    return document.getElementById(tableId);
}

// Muestra una notificación toast mejorada
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.error('Toast container no encontrado');
        return;
    }

    const toast = document.createElement('div');
    const icon = type === 'success' ? 
        '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' :
        '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
    
    const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';
    const borderColor = type === 'success' ? 'border-green-700' : 'border-red-700';
    
    toast.className = `flex items-center p-4 mb-2 w-full max-w-xs rounded-lg shadow-lg ${bgColor} ${borderColor} border-l-4 text-white transition-all duration-300 transform translate-x-4 opacity-0`;
    
    toast.innerHTML = `
        <div class="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg ${bgColor}">
            ${icon}
        </div>
        <div class="ml-3 text-sm font-normal">${message}</div>
        <button type="button" class="ml-auto -mx-1.5 -my-1.5 text-white hover:text-gray-100 rounded-lg p-1.5 inline-flex h-8 w-8" onclick="this.parentElement.remove()">
            <span class="sr-only">Cerrar</span>
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
        </button>
    `;
    
    container.appendChild(toast);

    // Animar entrada
    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-4', 'opacity-0');
        toast.classList.add('translate-x-0', 'opacity-100');
    });

    // Eliminar después de 5 segundos
    const timeout = setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-x-4');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 5000);

    // Pausar el timeout cuando el mouse está sobre el toast
    toast.addEventListener('mouseenter', () => clearTimeout(timeout));
    toast.addEventListener('mouseleave', () => {
        toast.classList.add('opacity-100', 'translate-x-0');
        setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-x-4');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 3000);
    });
}

// Función de inicialización
async function initializeGame() {
    console.log('Polla El Fenix inicializada');

    // Inicializar Supabase PRIMERO para que el cliente esté disponible
    if (typeof initializeSupabase === 'function') {
        if (!initializeSupabase()) {
            console.error("Fallo al inicializar Supabase. La aplicación no funcionará correctamente.");
            return; // Detener la ejecución si Supabase no se inicializa
        }
    } else {
        console.error("La función initializeSupabase no está definida. Asegúrate de que supabase-config.js se cargue correctamente.");
        return;
    }
    
    // Inicializar contadores
    playsCount = 0;
    winnersCount = 0;
    setupTabs();

    // Cargar potes guardados
    await loadPotsFromSupabase();
    
    // Generar filas iniciales para ambas tablas
    generatePollaTableRows();
    generateMicroTableRows();

    updateUIForGameType();
    prizesToDistribute = 0;
    prizeAmount = 0;
    
    // Cargar datos guardados desde Supabase (tickets/jugadas, ganadores y stats)
    await loadTicketsFromSupabase();
    await loadWinnersFromSupabase();
    // Cargar lista de jugadores desde Supabase en el modal si está abierto
    if (document.getElementById('playerManagerModal') && !document.getElementById('playerManagerModal').classList.contains('hidden')) {
        updatePlayersList();
    }

    // Cargar jugadores para autocompletado
    loadAllPlayersForAutocomplete();

    // Registrar listener para pegado desde Excel/Sheets
    document.addEventListener('paste', function(e) {
        // Solo manejar pegados cuando el foco esté dentro de las tablas o no en un campo de texto
        handleTablePaste(e);
    });

    // También añadir listeners específicos a los cuerpos de las tablas para asegurar comportamiento consistente
    const pollaBody = document.getElementById('pollaTableBody');
    const microBody = document.getElementById('microTableBody');
    if (pollaBody) pollaBody.addEventListener('paste', handleTablePaste);
    if (microBody) microBody.addEventListener('paste', handleTablePaste);
    
    // Marcar día actual
    highlightCurrentDay();
}

async function loadPotsFromSupabase() {
    const pollaPotRes = await PotesDB.obtener('polla');
    if (pollaPotRes.success && pollaPotRes.data) {
        // Merge with defaults to ensure all days are present
        dailyValues.polla = { ...dailyValues.polla, ...pollaPotRes.data };
    }

    const microPotRes = await PotesDB.obtener('micro');
    if (microPotRes.success && microPotRes.data) {
        dailyValues.micro = { ...dailyValues.micro, ...microPotRes.data };
    }

    // Update UI with the loaded values for the current game
    switchGameModeValues(currentGameType);
}

// Función para generar filas iniciales de la tabla
function generatePollaTableRows() {
    const tableBody = document.getElementById('pollaTableBody');
    tableBody.innerHTML = '';
    for (let i = 1; i <= 1500; i++) {
        const row = document.createElement('tr');
        row.className = 'text-center text-sm hover:bg-gray-50';
        row.dataset.rowId = i;
        row.innerHTML = `
            <td class="p-2 font-bold w-12">${i}</td>
            <td class="p-2 text-left cursor-pointer hover:bg-gray-100 rounded whitespace-nowrap min-w-[200px]" data-editable="name"></td>
            <td class="p-1 cursor-pointer hover:bg-gray-100 rounded w-12 text-center" data-editable="number" data-index="0"></td>
            <td class="p-1 cursor-pointer hover:bg-gray-100 rounded w-12 text-center" data-editable="number" data-index="1"></td>
            <td class="p-1 cursor-pointer hover:bg-gray-100 rounded w-12 text-center" data-editable="number" data-index="2"></td>
            <td class="p-1 cursor-pointer hover:bg-gray-100 rounded w-12 text-center" data-editable="number" data-index="3"></td>
            <td class="p-1 cursor-pointer hover:bg-gray-100 rounded w-12 text-center" data-editable="number" data-index="4"></td>
            <td class="p-1 cursor-pointer hover:bg-gray-100 rounded w-12 text-center" data-editable="number" data-index="5"></td>
            <td class="p-2 cursor-pointer hover:bg-gray-100 rounded" data-editable="gratis">NO</td>
            <td class="p-2 font-bold" data-hits="0">0</td>
            <td class="p-2">
                <button onclick="deletePlay(${i})" class="text-red-500 hover:text-red-700 font-semibold text-xs" title="Eliminar jugada">ELIMINAR</button>
            </td>
        `;
        setupRowEvents(row);
        tableBody.appendChild(row);
    }
}

function generateMicroTableRows() {
    const tableBody = document.getElementById('microTableBody');
    tableBody.innerHTML = '';
    for (let i = 1; i <= 1500; i++) {
        const row = document.createElement('tr');
        row.className = 'text-center text-sm hover:bg-gray-50';
        row.dataset.rowId = i;
        row.innerHTML = `
            <td class="p-2 font-bold w-12">${i}</td>
            <td class="p-2 text-left cursor-pointer hover:bg-gray-100 rounded whitespace-nowrap min-w-[200px]" data-editable="name"></td>
            <td class="p-2 cursor-pointer hover:bg-gray-100 rounded" data-editable="number" data-index="0"></td>
            <td class="p-2 cursor-pointer hover:bg-gray-100 rounded" data-editable="number" data-index="1"></td>
            <td class="p-2 cursor-pointer hover:bg-gray-100 rounded" data-editable="number" data-index="2"></td>
            <td class="p-2 cursor-pointer hover:bg-gray-100 rounded" data-editable="gratis">NO</td>
            <td class="p-2 font-bold" data-hits="0">0</td>
            <td class="p-2">
                <button onclick="deletePlay(${i})" class="text-red-500 hover:text-red-700 font-semibold text-xs" title="Eliminar jugada">ELIMINAR</button>
            </td>
        `;
        setupRowEvents(row);
        tableBody.appendChild(row);
    }
}

// Configurar eventos para una fila
function setupRowEvents(row) {
    const editableCells = row.querySelectorAll('[data-editable]');
    editableCells.forEach(cell => {
        if (cell.dataset.editable === 'gratis') {
            cell.addEventListener('click', function() {
                // Registrar la última celda clickeada
                lastClickedCell = this;
                toggleGratis(this, row);
            });
        } else {
            cell.addEventListener('click', function() {
                // Registrar la última celda clickeada
                lastClickedCell = this;
                makeCellEditable(this, row);
            });
        }
    });
}

// Manejar pegado desde Excel/Sheets para poblar múltiples filas a la vez
function handleTablePaste(e) {
    // Solo procesar si hay texto en el clipboard
    const clipboardData = (e.clipboardData || window.clipboardData);
    if (!clipboardData) return;

    const text = clipboardData.getData('Text') || clipboardData.getData('text/plain');
    if (!text) return;

    // Evitar que el navegador pegue el texto crudo en el input actual
    e.preventDefault();

    // Determinar la fila y celda de inicio
    let startCell = lastClickedCell;
    if (!startCell) {
        // Si no se ha hecho click, tomar la primera fila de la tabla visible
        startCell = document.querySelector('#' + (currentGameType === 'polla' ? 'pollaTableBody' : 'microTableBody') + ' tr td[data-editable]');
    }
    if (!startCell) return;

    const startRow = startCell.closest('tr');
    if (!startRow) return;

    // Parsear el texto: soportar tab, comma, semicolon y saltos de línea
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return;

    let pastedCount = 0;
    for (let i = 0; i < lines.length; i++) {
        const cols = lines[i].split(/\t|,|;/).map(c => c.trim());
        const targetRowIndex = parseInt(startRow.dataset.rowId || startRow.rowIndex) + i;

        // Encontrar la fila objetivo por data-row-id
        const tbodyId = currentGameType === 'polla' ? 'pollaTableBody' : 'microTableBody';
        const targetRow = document.querySelector(`#${tbodyId} tr[data-row-id="${targetRowIndex}"]`);
        if (!targetRow) continue;

        // Nombre y números: asumir first col = nombre, siguientes = números (3 o 6)
        const nameCell = targetRow.querySelector('td[data-editable="name"]');
        if (cols.length >= 1 && nameCell) {
            nameCell.textContent = cols[0];
        }

        // Números
        const numberCells = [...targetRow.querySelectorAll('td[data-editable="number"]')];
        for (let j = 0; j < numberCells.length; j++) {
            const val = cols[1 + j] || '';
            numberCells[j].textContent = val;
        }

        // Gratis si se proporciona (col siguiente a los números)
        const gratisCell = targetRow.querySelector('td[data-editable="gratis"]');
        const gratisColIndex = 1 + numberCells.length;
        if (gratisCell && cols[gratisColIndex] !== undefined) {
            const txt = cols[gratisColIndex].toString().toLowerCase();
            gratisCell.textContent = (txt === 's' || txt === 'si' || txt === 'sí' || txt === 'yes' || txt === 'y') ? 'SÍ' : 'NO';
        }

        // Actualizar datos y guardar si la fila tiene al menos un número
        updatePlayerData(targetRow);
        updatePlayersTable();

        // Guardar asincrónicamente la fila si tiene nombre o números
        const hasAny = (nameCell && nameCell.textContent.trim().length > 0) || numberCells.some(c => c.textContent.trim().length > 0);
        if (hasAny) {
            saveRowData(targetRow);
            pastedCount++;
        }
    }

    showToast(`Pegadas ${pastedCount} fila(s) desde el portapapeles`, 'success');
}

// Función para cambiar el estado de 'Gratis'
function toggleGratis(cell, row) {
    const isGratis = cell.textContent.trim() === 'SÍ';
    const newGratisState = !isGratis;
    cell.textContent = newGratisState ? 'SÍ' : 'NO';
    cell.classList.toggle('text-green-600', newGratisState);
    cell.classList.toggle('font-bold', newGratisState);
    updatePlayerData(row, newGratisState);
    updateCalculatedStats();
    saveRowData(row); // Guardado en tiempo real
}

// Configurar event listeners
function setupEventListeners() {
    // Event listeners para los números del tablero
    const numberCells = document.querySelectorAll('.number-cell');
    numberCells.forEach(cell => {
        cell.addEventListener('click', function() {
            selectNumber(this);
        });
    });
    
    // Event listeners para los días de la semana
    setupDayValueCells();

    // Event listeners para garantizado y acumulado
    const garantizadoInput = document.getElementById('garantizadoInput');
    if (garantizadoInput) {
        garantizadoInput.addEventListener('input', () => updateAdditionalPrizes());
    }
    const acumuladoInput = document.getElementById('acumuladoInput');
    if (acumuladoInput) {
        acumuladoInput.addEventListener('input', () => updateAdditionalPrizes());
    }
}

function switchGameModeValues(gameType) {
    const valuesToLoad = dailyValues[gameType];
    if (!valuesToLoad) return;

    // Day inputs
    const dayInputs = document.querySelectorAll('input[data-day]');
    dayInputs.forEach(input => {
        const day = input.dataset.day;
        const value = valuesToLoad[day] || 0;
        input.value = value > 0 ? value : '';
    });

    // Additional prize inputs
    const garantizadoInput = document.getElementById('garantizadoInput');
    const acumuladoInput = document.getElementById('acumuladoInput');
    
    if (garantizadoInput) {
        const garantizado = valuesToLoad.garantizado || 0;
        garantizadoInput.value = garantizado > 0 ? garantizado : '';
    }
    if (acumuladoInput) {
        const acumulado = valuesToLoad.acumulado || 0;
        acumuladoInput.value = acumulado > 0 ? acumulado : '';
    }

    // After loading new values, update all calculations
    updateTotalPot();
    updateAdditionalPrizes();
}

function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const pollaTable = document.getElementById('pollaTable');
    const microTable = document.getElementById('microTable');

    const setActiveTab = (gameType) => {
        tabs.forEach(t => {
            if (t.dataset.game === gameType) {
                t.classList.add('bg-white', 'text-fenix-blue');
                t.classList.remove('text-white');
            } else {
                t.classList.remove('bg-white', 'text-fenix-blue');
                t.classList.add('text-white');
            }
        });
        
        // Mostrar/ocultar tablas según el tipo de juego
        if (gameType === 'polla') {
            pollaTable.classList.remove('hidden');
            microTable.classList.add('hidden');
        } else {
            pollaTable.classList.add('hidden');
            microTable.classList.remove('hidden');
        }
    };

    // Set initial active tab
    setActiveTab(currentGameType);

    tabs.forEach(tab => {
        tab.addEventListener('click', async () => {
            const newGameType = tab.dataset.game;
            if (newGameType === currentGameType) return;

            currentGameType = newGameType;
            setActiveTab(currentGameType);
            
            // Cambiar los valores de los inputs de días y recalcular el pote
            switchGameModeValues(currentGameType);
            
            // Recargar los datos para el nuevo tipo de juego
            await loadTicketsFromSupabase();
            await loadWinnersFromSupabase();
        });
    });
}

function updateUIForGameType() {
    const isPolla = currentGameType === 'polla';

    // 2. Mostrar/ocultar columnas en el modal
    document.querySelectorAll('.polla-only').forEach(el => {
        el.classList.toggle('hidden', !isPolla);
    });

    // 4. Actualizar el modal de "Agregar Jugada"
    const modalTitle = document.getElementById('addPlayerModalTitle');
    const modalNumbersLabel = document.getElementById('addPlayerModalNumbersLabel');
    const numberInputs = [document.getElementById('number4'), document.getElementById('number5'), document.getElementById('number6')];

    modalTitle.textContent = 'AGREGAR NUEVA JUGADA';
    modalNumbersLabel.textContent = isPolla ? 'NÚMEROS DEL JUGADOR (6 números):' : 'NÚMEROS DEL JUGADOR (3 números):';
    
    numberInputs.forEach(input => {
        if (input) {
            input.required = isPolla;
        }
    });

    // 5. Mostrar/ocultar la leyenda de colores
    const legend = document.getElementById('colorLegend');
    if (legend) {
        legend.classList.toggle('hidden', !isPolla);
    }
}

// Configurar event listeners para las celdas de valores de días
function setupDayValueCells() {
    const dayInputs = document.querySelectorAll('input[data-day]');
    dayInputs.forEach(input => {
        input.addEventListener('input', function() {
            updateTotalPot();
        });
        
        input.addEventListener('blur', function() {
            updateTotalPot();
        });
    });
}

function debounce(func, delay) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(func, delay);
}

// Función para actualizar el total del pote
function updateTotalPot() {
    const dayInputs = document.querySelectorAll('input[data-day]');
    let total = 0;
    const currentDayValues = dailyValues[currentGameType];
    
    dayInputs.forEach(input => {
        const day = input.dataset.day;
        const value = parseInt(input.value) || 0;
        total += value;

        // Guardar el valor para el modo de juego actual
        if (currentDayValues && day) {
            currentDayValues[day] = value;
        }
    });
    
    document.getElementById('totalPotValue').textContent = total;
    updateCalculatedStats();

    // Guardar en la base de datos con debounce
    debounce(() => {
        if (typeof PotesDB !== 'undefined' && PotesDB.actualizar) {
            console.log(`Guardando pote para ${currentGameType}...`);
            PotesDB.actualizar(currentGameType, currentDayValues).catch(err => {
                console.error("Error al guardar el pote en la BD:", err);
            });
        }
    }, 1000); // Guardar 1 segundo después de la última modificación
}

// Función para actualizar y guardar premios adicionales
function updateAdditionalPrizes() {
    const garantizado = parseInt(document.getElementById('garantizadoInput').value) || 0;
    const acumulado = parseInt(document.getElementById('acumuladoInput').value) || 0;
    
    const currentPrizeValues = dailyValues[currentGameType];
    if (currentPrizeValues) {
        currentPrizeValues.garantizado = garantizado;
        currentPrizeValues.acumulado = acumulado;
    }

    // Recalculate everything that depends on these values
    updateCalculatedStats();

    // Save to DB using the same debounce logic as the pot
    debounce(() => {
        if (typeof PotesDB !== 'undefined' && PotesDB.actualizar) {
            console.log(`Guardando premios adicionales para ${currentGameType}...`);
            PotesDB.actualizar(currentGameType, dailyValues[currentGameType]).catch(err => {
                console.error("Error al guardar premios adicionales en la BD:", err);
            });
        }
    }, 1000);
}

// Función para limpiar solo el pote semanal
function clearCurrentPot() {
    const gameName = currentGameType === 'polla' ? 'Polla' : 'Micro';
    if (!confirm(`¿Estás seguro de que quieres limpiar el pote semanal para la ${gameName}? Esto pondrá todos los valores de los días en cero.`)) {
        return;
    }

    try {
        console.log(`Limpiando pote para ${gameName}...`);
        
        // 1. Resetear los valores de los días en memoria para el modo actual
        const currentPotValues = dailyValues[currentGameType];
        if (currentPotValues) {
            ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'].forEach(day => {
                currentPotValues[day] = 0;
            });
        }

        // 2. Limpiar los inputs de los días en la UI
        document.querySelectorAll('input[data-day]').forEach(input => {
            input.value = '';
        });

        // 3. Forzar el recálculo y guardado en la BD
        updateTotalPot();

        showToast(`¡El pote semanal de la ${gameName} ha sido limpiado exitosamente!`);
    } catch (error) {
        console.error('Error al limpiar el pote:', error);
        alert('Error al limpiar el pote: ' + error.message);
    }
}

// Función para resetear toda la app
async function resetAll() {
    // Mostrar modal de confirmación (index)
    const modal = document.getElementById('confirmResetModalIndex');
    const cancelBtn = document.getElementById('cancelResetIndexBtn');
    const confirmBtn = document.getElementById('confirmResetIndexBtn');
    if (!modal || !cancelBtn || !confirmBtn) {
        console.error('Modal de confirmación (index) no encontrado en el DOM.');
        return;
    }

    modal.classList.remove('hidden');

    const closeModal = () => {
        modal.classList.add('hidden');
        cancelBtn.removeEventListener('click', onCancel);
        confirmBtn.removeEventListener('click', onConfirm);
    };

    const onCancel = () => {
        closeModal();
    };

    const onConfirm = async () => {
        closeModal();
        const gameName = currentGameType === 'polla' ? 'Polla' : 'Micro';
        const jugadasDB = currentGameType === 'polla' ? JugadasPollaDB : JugadasMicroDB;
        try {
            // Borrar SOLO las jugadas
            const jugadasRes = await jugadasDB.deleteAll();
            if (!jugadasRes.success) {
                throw new Error(jugadasRes.error || `Error borrando jugadas de ${gameName}`);
            }

            // No se tocan números ganadores ni pote
            // Refrescar UI
            await loadTicketsFromSupabase();
            showToast(`Todas las jugadas de la ${gameName} han sido borradas.`, 'success');
        } catch (error) {
            console.error('Error al borrar jugadas:', error);
            showToast('Error al borrar las jugadas: ' + (error.message || error), 'error');
        }
    };

    cancelBtn.addEventListener('click', onCancel);
    confirmBtn.addEventListener('click', onConfirm);
}

// Elimina una jugada de la UI y la base de datos
async function deletePlay(rowId) {
    if (!confirm(`¿Estás seguro de que quieres eliminar la jugada #${rowId}?`)) return;

    const targetPlayersArray = currentGameType === 'polla' ? pollaPlayers : microPlayers;
    const playerIndex = targetPlayersArray.findIndex(p => p.id === rowId);
    
    if (playerIndex === -1) {
        showToast('No se encontró la jugada para eliminar.', 'error');
        return;
    }

    const player = targetPlayersArray[playerIndex];
    const dbId = player.dbId;

    // Si existe en la BD, eliminarla de allí
    if (dbId) {
        const dbManager = currentGameType === 'polla' ? JugadasPollaDB : JugadasMicroDB;
        const res = await dbManager.eliminar(dbId);
        if (!res.success) {
            showToast(`Error al eliminar de la base de datos: ${res.error}`, 'error');
            return;
        }
    }

    // Eliminar del array local
    targetPlayersArray.splice(playerIndex, 1);

    // Limpiar la fila en la UI
    const tableBody = getCurrentTableBody();
    const row = tableBody.querySelector(`tr[data-row-id="${rowId}"]`);
    if (row) {
        const numCount = currentGameType === 'polla' ? 6 : 3;
        let newRowContent = `<td class="p-2 font-bold">${rowId}</td>`;
        newRowContent += `<td class="p-2 text-left cursor-pointer hover:bg-gray-100 rounded" data-editable="name"></td>`;
        for (let i = 0; i < numCount; i++) {
            newRowContent += `<td class="p-2 cursor-pointer hover:bg-gray-100 rounded" data-editable="number" data-index="${i}"></td>`;
        }
        newRowContent += `<td class="p-2 cursor-pointer hover:bg-gray-100 rounded" data-editable="gratis">NO</td>`;
        newRowContent += `<td class="p-2 font-bold" data-hits="0">0</td>`;
        newRowContent += `<td class="p-2"><button onclick="deletePlay(${rowId})" class="text-red-500 hover:text-red-700 font-semibold text-xs" title="Eliminar jugada">ELIMINAR</button></td>`;
        
        row.innerHTML = newRowContent;
        row.removeAttribute('data-db-id');
    applyHitsColors(row, 0, currentGameType);
        setupRowEvents(row); // Volver a adjuntar eventos a las nuevas celdas
    }

    updatePlaysCounter();
    showToast(`Jugada #${rowId} eliminada.`, 'success');
}

// Guarda los datos de una sola fila en la base de datos
async function saveRowData(row) {
    const rowId = parseInt(row.dataset.rowId, 10);
    const targetPlayersArray = currentGameType === 'polla' ? pollaPlayers : microPlayers;
    const playerData = targetPlayersArray.find(p => p.id === rowId);

    if (!playerData || !playerData.isComplete) {
        return; // No guardar filas incompletas
    }

    const dbManager = currentGameType === 'polla' ? JugadasPollaDB : JugadasMicroDB;
    
    const dataToSave = {
        nombre_jugador: playerData.name,
        gratis: playerData.gratis,
    };
    playerData.numbers.forEach((num, i) => dataToSave[`nro_${i+1}`] = num);

    let res;
    if (playerData.dbId) {
        dataToSave.id = playerData.dbId;
        res = await dbManager.actualizar([dataToSave]);
    } else {
        res = await dbManager.crear([dataToSave]);
    }

    if (res.success && res.data && res.data.length > 0) {
        const savedData = res.data[0];
        // Actualizar datos locales y UI con el nuevo dbId
        playerData.dbId = savedData.id;
        row.dataset.dbId = savedData.id;
        showToast(`Jugada #${playerData.id} guardada.`, 'success');
    } else {
        showToast(`Error al guardar jugada #${playerData.id}: ${res.error}`, 'error');
    }
}

async function resetAll() {
    // Legacy full-reset function removed on purpose.
    // The app now uses a modal-driven reset that only deletes jugadas (tickets) to avoid accidental
    // deletion of winners or pot values. The modal-driven `resetAll()` (defined earlier) handles
    // confirmation and deletion of jugadas only.
}

// Función para seleccionar/deseleccionar un número ganador
async function selectNumber(cell) {
    const number = cell.textContent.trim();
    
    if (cell.classList.contains('selected')) {
        // Si ya está seleccionado, lo deseleccionamos
        cell.classList.remove('selected', 'ring-yellow-400', 'transform', 'scale-110', 'bg-yellow-300', 'text-black');
        winningNumbers.delete(number);
    } else {
        // Si no está seleccionado, lo seleccionamos
        cell.classList.add('selected', 'ring-yellow-400', 'transform', 'scale-110', 'bg-yellow-300', 'text-black');
        winningNumbers.add(number);
    }
    
    await updateWinningNumbersInDB();
}

// Función para actualizar los números ganadores en la base de datos
async function updateWinningNumbersInDB() {
    const nums = Array.from(winningNumbers);
    const dbManager = currentGameType === 'polla' ? ResultadosNumerosDB : ResultadosMicroDB;
    const msg = document.getElementById('winnersMsg');

    if (!dbManager || !dbManager.crear || !dbManager.eliminarUltimo) {
        msg.textContent = 'Error: Funcionalidad de base de datos no disponible.';
        msg.className = 'text-red-600 text-center text-sm mb-4';
        return;
    }

    try {
        // Siempre eliminamos el último registro para evitar duplicados o registros huérfanos.
        await dbManager.eliminarUltimo();
        
        // Solo creamos un nuevo registro si hay números seleccionados.
        if (nums.length > 0) {
            const createRes = await dbManager.crear(nums);
            if (!createRes.success) {
                // Si la creación falla, lanzamos un error para que lo capture el catch.
                throw new Error(createRes.error || 'Error desconocido al guardar.');
            }
        }
        
        // Si llegamos aquí, la operación fue exitosa.
        msg.textContent = 'Números ganadores actualizados.';
        msg.className = 'text-green-600 text-center text-sm mb-4';
        
    } catch (error) {
        msg.textContent = 'Error al guardar: ' + error.message;
        msg.className = 'text-red-600 text-center text-sm mb-4';
    } finally {
        // Actualizamos la tabla de jugadores para reflejar los cambios en los aciertos.
        updatePlayersTable();
        // Limpiamos el mensaje después de un tiempo.
        setTimeout(() => { if (msg) msg.textContent = ''; }, 3000);
    }
}

// Función para resaltar el día actual
function highlightCurrentDay() {
    const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const today = new Date().getDay();
    const currentDay = days[today];
    
    const dayInput = document.querySelector(`input[data-day="${currentDay}"]`);
    if (dayInput) {
        dayInput.parentElement.previousElementSibling.classList.add('bg-blue-700');
    }
}

// Cache de elementos editables para evitar duplicados
const editableCache = new WeakMap();

// Función para hacer una celda editable
function makeCellEditable(cell, row) {
    // Usar caché para evitar recrear inputs innecesariamente
    if (editableCache.has(cell) && document.body.contains(editableCache.get(cell))) {
        const input = editableCache.get(cell);
        input.focus();
        input.select();
        return;
    }
    
    // Limpiar referencias anteriores
    editableCache.delete(cell);

    const currentValue = cell.textContent.trim();
    const isNumberCell = cell.hasAttribute('data-editable') && cell.getAttribute('data-editable') === 'number';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentValue;
    
    // Aplicar estilos diferentes para celdas de nombre vs números
    if (cell.dataset.editable === 'name') {
        input.className = 'w-full min-w-[100px] border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300';
    } else {
        input.className = 'w-12 text-center border border-blue-300 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300';
    }
    
    input.style.height = '1.75rem'; // Altura fija para mantener consistencia

    // Limpiar la celda y agregar el input
    if (cell.dataset.editable === 'name' && cell.dataset.editable !== 'gratis') {
        // Para el autocompletado, necesitamos un contenedor
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.appendChild(input);

        const suggestionsContainer = document.createElement('div');
        suggestionsContainer.className = 'absolute z-20 w-full bg-white border border-gray-300 rounded-lg mt-1 hidden';
        wrapper.appendChild(suggestionsContainer);

        // Asegurarnos de que la lista de jugadores esté cargada para el autocompletado
        if (!allPlayersSupabase || allPlayersSupabase.length === 0) {
            loadAllPlayersForAutocomplete().catch(err => console.error('Error cargando jugadores para autocomplete (tabla):', err));
        }

        cell.innerHTML = '';
        cell.appendChild(wrapper);

        input.addEventListener('input', (e) => handleAutocompleteInput(e.target, suggestionsContainer));
        input.addEventListener('keydown', (e) => handleAutocompleteKeydown(e, e.target, suggestionsContainer));
        input.addEventListener('blur', () => {
            // Delay to allow click on suggestion
            setTimeout(async () => {
                // Antes de ocultar, si escribió un nombre nuevo, guardarlo en la base de datos de jugadores
                const typed = input.value.trim();
                if (typed) {
                    const exists = allPlayersSupabase.some(p => p.toLowerCase() === typed.toLowerCase());
                    if (!exists) {
                        // Intentar guardar en JugadoresDB (si está disponible)
                        try {
                            if (typeof JugadoresDB !== 'undefined' && JugadoresDB.crear) {
                                const res = await JugadoresDB.crear(typed);
                                if (res && res.success) {
                                    // Agregar al array en memoria
                                    allPlayersSupabase.push(typed);
                                } else {
                                    console.warn('No se pudo guardar jugador nuevo:', res && res.error);
                                }
                            } else {
                                // Si no hay JugadoresDB, igual agregar en memoria para autocompletar en la sesión
                                allPlayersSupabase.push(typed);
                            }
                        } catch (err) {
                            console.error('Error al guardar jugador nuevo automáticamente:', err);
                        }
                    }
                }
                hideAutocomplete(suggestionsContainer);
            }, 200);
        });

    } else {
        // Para celdas de número, reemplazar el contenido directamente
        cell.innerHTML = '';
        cell.appendChild(input);
        
        // Enfocar y seleccionar el texto inmediatamente
        setTimeout(() => {
            input.focus();
            input.select();
        }, 0);
    }
    // Usar requestAnimationFrame para mejor rendimiento
    requestAnimationFrame(() => {
        input.focus();
        input.select();
        
        // Almacenar en caché
        if (PERF_CONFIG.cacheDom) {
            editableCache.set(cell, input);
        }
    });

    if (isNumberCell) {
        input.addEventListener('input', function() {
            validateNumberInput(input);
        });

        // Solo permitir números válidos en tiempo real
        input.addEventListener('keypress', function(e) {
            const validNumbers = ['0', '00', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
                                 '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
                                 '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
                                 '31', '32', '33', '34', '35', '36'];

            // Permitir teclas de control
            if (["Backspace", "Delete", "Tab", "Enter", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
                return;
            }

            // Verificar si el valor completo será válido
            const newValue = input.value + e.key;
            if (!validNumbers.some(num => num.startsWith(newValue))) {
                e.preventDefault();
            }
        });
    }

    // Manejar pérdida de foco
    input.addEventListener('blur', function() {
        if (isNumberCell) {
            const newValue = input.value.trim();
            
            // Si el valor no cambió, no hacer nada
            if (newValue === currentValue) {
                cell.textContent = currentValue;
                return;
            }
            
            // Si se deja vacío, restaurar el valor anterior
            if (newValue === '') {
                cell.textContent = currentValue;
                return;
            }
            
            // Validar el formato del número
            if (validateNumberInput(input)) {
                const oldValue = cell.textContent;
                
                // Actualizar el valor en la celda
                cell.textContent = newValue;
                
                // Validar números únicos
                if (!validateUniqueNumbers(row, cell)) {
                    // Si no es único, restaurar el valor anterior
                    cell.textContent = oldValue;
                    showToast('¡Número duplicado en esta fila!', 'error');
                } else {
                    // Si el valor es válido, actualizar la interfaz
                    updatePlayerData(row);
                    updatePlayersTable();
                    saveRowData(row);
                    showToast('Número actualizado correctamente', 'success');
                }
            } else {
                // Si la validación falla, restaurar el valor anterior
                cell.textContent = currentValue;
                showToast('Por favor ingrese un número válido (0-36)', 'error');
            }
        } else {
            // Para la celda de nombre
            cell.textContent = input.value.trim() || currentValue;
            updatePlayerData(row);
            updatePlayersTable();
            saveRowData(row); // Guardado en tiempo real
        }
    });

    // Manejar tecla Enter
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            // Forzar el blur para que se procese el cambio
            input.blur();
            
            // Si es una celda de número, mover el foco al siguiente campo
            if (isNumberCell) {
                const nextCell = cell.nextElementSibling;
                if (nextCell && nextCell.dataset.editable) {
                    makeCellEditable(nextCell, row);
                } else {
                    // Si es la última celda, ir a la primera de la siguiente fila
                    const nextRow = row.nextElementSibling;
                    if (nextRow) {
                        const firstEditable = nextRow.querySelector('[data-editable]');
                        if (firstEditable) makeCellEditable(firstEditable, nextRow);
                    }
                }
            }
        }
    });
    
    // Hacer la celda editable con clic
    cell.addEventListener('click', function(e) {
        // Solo activar la edición si no es la celda de Gratis
        if (cell.dataset.editable !== 'gratis') {
            e.stopPropagation();
            makeCellEditable(cell, row);
        }
    });

    // Manejar tecla Escape para cancelar
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            input.value = currentValue;
            input.blur();
            // Restaurar el valor original
            cell.textContent = currentValue;
        }
    });

    // Manejar Tab para pasar al siguiente input editable
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            // Buscar todas las celdas editables de la tabla
            const tableBody = getCurrentTableBody();
            const allRows = Array.from(tableBody.querySelectorAll('tr'));
            let allEditableCells = [];
            allRows.forEach(r => {
                allEditableCells = allEditableCells.concat(Array.from(r.querySelectorAll('[data-editable]')));
            });
            // Buscar el índice de la celda actual
            const idx = allEditableCells.indexOf(cell);
            if (idx !== -1) {
                const nextIdx = e.shiftKey ? idx - 1 : idx + 1;
                if (nextIdx >= 0 && nextIdx < allEditableCells.length) {
                    setTimeout(() => {
                        makeCellEditable(allEditableCells[nextIdx], allEditableCells[nextIdx].parentElement);
                    }, 0);
                } else {
                    // Si no hay siguiente, cerrar el input
                    input.blur();
                }
            }
        }
    });

    // Manejar ArrowRight para moverse a la siguiente celda editable si el cursor está al final
    input.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowRight') {
            // solo navegar si no hay modificadores y el caret está al final del input
            if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
            try {
                const selEnd = typeof input.selectionEnd === 'number' ? input.selectionEnd : null;
                if (selEnd !== null && selEnd === input.value.length) {
                    e.preventDefault();
                    const tableBody = getCurrentTableBody();
                    const allRows = Array.from(tableBody.querySelectorAll('tr'));
                    let allEditableCells = [];
                    allRows.forEach(r => {
                        allEditableCells = allEditableCells.concat(Array.from(r.querySelectorAll('[data-editable]')));
                    });
                    const idx = allEditableCells.indexOf(cell);
                    if (idx !== -1) {
                        const nextIdx = idx + 1; // siempre hacia la derecha
                        if (nextIdx >= 0 && nextIdx < allEditableCells.length) {
                            setTimeout(() => {
                                makeCellEditable(allEditableCells[nextIdx], allEditableCells[nextIdx].parentElement);
                            }, 0);
                        } else {
                            input.blur();
                        }
                    }
                }
            } catch (err) {
                // fallback: no bloquear la tecla
                console.error('Error manejando ArrowRight navigation:', err);
            }
        }
    });

    // Manejar ArrowLeft para moverse a la celda editable anterior si el cursor está al inicio
    input.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowLeft') {
            // solo navegar si no hay modificadores y el caret está al inicio
            if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
            try {
                const selStart = typeof input.selectionStart === 'number' ? input.selectionStart : null;
                if (selStart !== null && selStart === 0) {
                    e.preventDefault();
                    const tableBody = getCurrentTableBody();
                    const allRows = Array.from(tableBody.querySelectorAll('tr'));
                    let allEditableCells = [];
                    allRows.forEach(r => {
                        allEditableCells = allEditableCells.concat(Array.from(r.querySelectorAll('[data-editable]')));
                    });
                    const idx = allEditableCells.indexOf(cell);
                    if (idx !== -1) {
                        const prevIdx = idx - 1; // hacia la izquierda
                        if (prevIdx >= 0 && prevIdx < allEditableCells.length) {
                            setTimeout(() => {
                                makeCellEditable(allEditableCells[prevIdx], allEditableCells[prevIdx].parentElement);
                            }, 0);
                        } else {
                            input.blur();
                        }
                    }
                }
            } catch (err) {
                console.error('Error manejando ArrowLeft navigation:', err);
            }
        }
    });

    // Manejar ArrowUp para moverse a la celda editable de la fila superior (misma columna)
    input.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowUp') {
            if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
            e.preventDefault();
            try {
                const tableBody = getCurrentTableBody();
                const rows = Array.from(tableBody.querySelectorAll('tr'));
                const currentRow = cell.parentElement;
                const rowIdx = rows.indexOf(currentRow);
                if (rowIdx > 0) {
                    const colIndex = Array.prototype.indexOf.call(currentRow.cells, cell);
                    // Buscar hacia arriba la primera fila que tenga una celda editable en la misma columna
                    for (let r = rowIdx - 1; r >= 0; r--) {
                        const targetRow = rows[r];
                        if (!targetRow || !targetRow.cells) continue;
                        const targetCell = targetRow.cells[colIndex];
                        if (targetCell && targetCell.hasAttribute && targetCell.hasAttribute('data-editable')) {
                            setTimeout(() => {
                                makeCellEditable(targetCell, targetRow);
                            }, 0);
                            break;
                        }
                    }
                }
            } catch (err) {
                console.error('Error manejando ArrowUp navigation:', err);
            }
        }
    });

    // Manejar ArrowDown para moverse a la celda editable de la fila inferior (misma columna)
    input.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowDown') {
            if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
            e.preventDefault();
            try {
                const tableBody = getCurrentTableBody();
                const rows = Array.from(tableBody.querySelectorAll('tr'));
                const currentRow = cell.parentElement;
                const rowIdx = rows.indexOf(currentRow);
                if (rowIdx >= 0 && rowIdx < rows.length - 1) {
                    const colIndex = Array.prototype.indexOf.call(currentRow.cells, cell);
                    // Buscar hacia abajo la primera fila que tenga una celda editable en la misma columna
                    for (let r = rowIdx + 1; r < rows.length; r++) {
                        const targetRow = rows[r];
                        if (!targetRow || !targetRow.cells) continue;
                        const targetCell = targetRow.cells[colIndex];
                        if (targetCell && targetCell.hasAttribute && targetCell.hasAttribute('data-editable')) {
                            setTimeout(() => {
                                makeCellEditable(targetCell, targetRow);
                            }, 0);
                            break;
                        }
                    }
                }
            } catch (err) {
                console.error('Error manejando ArrowDown navigation:', err);
            }
        }
    });
}

// Función para validar entrada de números
function validateNumberInput(input) {
    const value = input.value.trim();
    const validNumbers = ['0', '00', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
                         '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
                         '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
                         '31', '32', '33', '34', '35', '36'];
    
    if (value === '' || validNumbers.includes(value)) {
        input.classList.remove('bg-red-100');
        return true;
    } else {
        input.classList.add('bg-red-100');
        return false;
    }
}

// Función para validar números repetidos en la misma fila
function validateUniqueNumbers(row, currentCell) {
    const numberCells = row.querySelectorAll('[data-editable="number"]');
    const currentValue = currentCell.textContent.trim();
    
    // Solo validar si hay un valor
    if (!currentValue) return true;
    
    // Verificar si el número ya existe en otras celdas de números
    for (let cell of numberCells) {
        if (cell !== currentCell && cell.textContent.trim() === currentValue) {
            // Número repetido encontrado
            currentCell.classList.add('bg-red-200', 'border-red-500');
            currentCell.textContent = '';
            alert(`Error: El número ${currentValue} ya está en uso en esta fila. No se pueden repetir números.`);
            return false;
        }
    }
    
    // Si no hay repetición, limpiar estilos de error
    currentCell.classList.remove('bg-red-200', 'border-red-500');
    return true;
}

// Función para actualizar datos del jugador
function updatePlayerData(row, isGratis = null, dbId = null) {
    const cells = row.cells;
    const playerId = parseInt(row.dataset.rowId, 10); // Usar ID de fila estable
    const name = cells[1].textContent.trim(); // La celda 1 es el nombre
    const targetPlayersArray = currentGameType === 'polla' ? pollaPlayers : microPlayers;
    
    // Obtener los 6 números del jugador
    const numCount = currentGameType === 'polla' ? 6 : 3;
    const playerNumbers = [];
    for (let i = 2; i <= 2 + numCount - 1; i++) { // Las celdas de números empiezan en el índice 2
        const number = cells[i].textContent.trim();
        if (number) {
            playerNumbers.push(number);
        }
    }
    
    // Verificar si la fila está completa
    const isComplete = name !== '' && playerNumbers.length === numCount;
    
    // Actualizar o crear entrada del jugador
    const existingPlayerIndex = targetPlayersArray.findIndex(p => p.id === playerId);
    const existingPlayer = existingPlayerIndex >= 0 ? targetPlayersArray[existingPlayerIndex] : {};
    const playerData = {
        id: playerId,
        dbId: dbId !== null ? dbId : (existingPlayer.dbId || null),
        name: name,
        numbers: playerNumbers,
        hits: 0,
        isComplete: isComplete,
        gratis: isGratis !== null ? isGratis : (existingPlayer.gratis || false)
    };
    
    if (existingPlayerIndex >= 0) {
        targetPlayersArray[existingPlayerIndex] = playerData;
    } else {
        targetPlayersArray.push(playerData);
    }
    
    // Actualizar contador de jugadas solo con filas completas
}

// Función para actualizar contador de jugadas
function updatePlaysCounter() {
    const currentPlayers = currentGameType === 'polla' ? pollaPlayers : microPlayers;
    const completePlayers = currentPlayers.filter(p => p.isComplete);
    playsCount = completePlayers.length;
    document.getElementById('playsCount').textContent = playsCount;
    
    const jugadasId = currentGameType === 'polla' ? 'pollaTableJugadas' : 'microTableJugadas';
    document.getElementById(jugadasId).textContent = playsCount;
    
    // Actualizar estadísticas calculadas
    updateCalculatedStats();
}

// Función para actualizar estadísticas calculadas
function updateCalculatedStats() {
    // 1. Obtener valores base de la UI y memoria
    const poteSemanal = dailyValues[currentGameType].lunes + dailyValues[currentGameType].martes + dailyValues[currentGameType].miércoles + dailyValues[currentGameType].jueves + dailyValues[currentGameType].viernes + dailyValues[currentGameType].sábado + dailyValues[currentGameType].domingo || 0;
    
    // 2. Obtener datos de jugadores
    const currentPlayers = currentGameType === 'polla' ? pollaPlayers : microPlayers;
    const completePlayers = currentPlayers.filter(p => p.isComplete);

    // 3. Calcular recaudación
    const precioJugada = 30;
    const gratisCount = completePlayers.filter(p => p.gratis === true).length;
    const payingPlayersCount = completePlayers.length - gratisCount;
    const premioTotal = payingPlayersCount * precioJugada;
    const recaudadoParaPremio = premioTotal * 0.8;

    const garantizado = dailyValues[currentGameType].garantizado || 0;
    const acumulado = dailyValues[currentGameType].acumulado || 0;
    // 4. Calcular el pozo total para el premio mayor
    const pozoTotal = recaudadoParaPremio + poteSemanal + acumulado;

    // 5. Identificar ganadores usando umbral fijo (6 para polla, 3 para micro)
    const thresholdHits = currentGameType === 'polla' ? 6 : 3;
    const ganadores = completePlayers.filter(player => player.hits === thresholdHits);
    const cantidadGanadores = ganadores.length; // Total de ganadores (pagados y gratis)
    
    const ganadoresPagados = ganadores.filter(player => player.gratis === false);
    const cantidadGanadoresPagados = ganadoresPagados.length; // Solo ganadores que pagaron
    // 6. Calcular premio por ganador (pagado) SOLO si hay ganadores en el umbral fijo
    premioPorGanador = 0; // Resetear antes de calcular
    if (cantidadGanadoresPagados > 0) {
        premioPorGanador = Math.floor(pozoTotal / cantidadGanadoresPagados);

        // 7. Aplicar premio garantizado si es necesario
        if (premioPorGanador < garantizado) {
            premioPorGanador = garantizado;
        }
    } else {
        // No hay ganadores en el nivel máximo; no ceder el premio a niveles inferiores
        premioPorGanador = 0;
    }

    // 9. Actualizar la interfaz
    updateStatDisplay('menos20', recaudadoParaPremio); // Esto es "Aporte a Premio (80%)"
    updateStatDisplay('pote', poteSemanal);
    updateStatDisplay('plays', completePlayers.length);
    updateStatDisplay('gratis', gratisCount);
    updateStatDisplay('garantizado', garantizado);
    updateStatDisplay('acumulado', acumulado);
    updateStatDisplay('winners', cantidadGanadores);
    updateStatDisplay('premios', cantidadGanadores > 0 ? Math.floor(pozoTotal / cantidadGanadores) : 0);
    updateStatDisplay('prize', pozoTotal);
    updateStatDisplay('totalPrizePool', pozoTotal);
    updateStatDisplay('total', premioTotal)
}

// Función para actualizar display de estadísticas
function updateStatDisplay(statType, value) {
    const elements = {
        'total': document.getElementById('totalValue'),
        'menos20': document.getElementById('menos20Value'),
        'pote': document.getElementById('poteValue'),
        'plays': document.getElementById('playsCount'),
        'gratis': document.getElementById('gratisCount'),
        'garantizado': document.getElementById('garantizadoValue'),
        'acumulado': document.getElementById('acumuladoValue'),
        'winners': document.getElementById('winnersCount'),
        'premios': document.getElementById('prizesToDistribute'),
        'prize': document.getElementById('prizeAmount'),
        'totalPrizePool': document.getElementById('totalPrizePool'),
    };
    
    if (elements[statType]) {
        elements[statType].textContent = value;
    }
}

// Función para actualizar la tabla correcta según el tipo de juego
function updatePlayersTable() {
    if (currentGameType === 'polla') {
        updatePollaTable();
    } else {
        updateMicroTable();
    }
}

// Función para actualizar tabla Polla
function updatePollaTable() {
    const tableBody = document.getElementById('pollaTableBody');
    const rows = tableBody.querySelectorAll('tr');
    
    // Calcular aciertos para cada jugador de polla
    pollaPlayers.forEach(player => {
        player.hits = 0;
        player.numbers.forEach(number => {
            if (number && winningNumbers.has(number)) {
                player.hits++;
            }
        });
    });
    
    // Actualizar filas existentes
    rows.forEach((row, index) => {
        const cells = row.cells;
        const playerId = parseInt(row.dataset.rowId, 10);
        const player = pollaPlayers.find(p => p.id === playerId);
        
        if (player) {
            // Actualizar aciertos
            const hitsCell = cells[9]; // Última celda para polla
            hitsCell.textContent = player.hits;
            hitsCell.setAttribute('data-hits', player.hits);
            
            // Marcar números ganadores
            for (let i = 2; i <= 7; i++) { // Celdas de números
                const numberCell = cells[i];
                const number = numberCell.textContent.trim();
                
                numberCell.className = 'p-2 cursor-pointer hover:bg-gray-100 rounded'; // Reset class
                
                if (number && winningNumbers.has(number)) {
                    numberCell.classList.add('bg-green-500', 'text-white', 'font-bold');
                }
            }
            
            // Aplicar colores según aciertos
            applyHitsColors(row, player.hits, 'polla');
        }
    });
    
    updateCalculatedStats();
}

// Función para actualizar tabla Micro
function updateMicroTable() {
    const tableBody = document.getElementById('microTableBody');
    const rows = tableBody.querySelectorAll('tr');
    
    // Calcular aciertos para cada jugador de micro
    microPlayers.forEach(player => {
        player.hits = 0;
        player.numbers.forEach(number => { // 'number' puede ser un string vacío si la celda está vacía
            if (winningNumbers.has(number)) {
                player.hits++;
            }
        });
    });
    
    // Actualizar filas existentes
    rows.forEach((row, index) => {
        const cells = row.cells;
        const playerId = parseInt(row.dataset.rowId, 10);
        const player = microPlayers.find(p => p.id === playerId);
        
        if (player) {
            // Actualizar aciertos
            const hitsCell = cells[6]; // Última celda para micro
            hitsCell.textContent = player.hits;
            hitsCell.setAttribute('data-hits', player.hits);
            
            // Marcar números ganadores
            for (let i = 2; i <= 4; i++) { // Celdas de números
                const numberCell = cells[i];
                const number = numberCell.textContent.trim();
                
                numberCell.className = 'p-2 cursor-pointer hover:bg-gray-100 rounded'; // Reset class
                
                if (number && winningNumbers.has(number)) {
                    numberCell.classList.add('bg-blue-500', 'text-white', 'font-bold');
                }
            }
            
            // Aplicar colores según aciertos
            applyHitsColors(row, player.hits, 'micro');
        }
    });
    
    updateCalculatedStats();
}

// Función para aplicar colores según aciertos
// Ahora acepta opcionalmente `gameType` ('polla'|'micro'). Si no se pasa, usa `currentGameType`.
function applyHitsColors(row, hits, gameType) {
    // Limpiar estilos previos
    row.style.backgroundColor = '';
    const hitsCell = row.querySelector('[data-hits]');
    if (hitsCell) {
        hitsCell.style.backgroundColor = '';
        hitsCell.style.color = ''; // Reset color
        // Remover clases de estado previas para evitar acumulación
        hitsCell.classList.remove('bg-gray-200');
        hitsCell.classList.remove('rounded', 'font-bold');
    }

    let bgColor = '';
    let textColor = 'white';
    let rowBgColor = '';
    // Determinar tipo de juego
    gameType = gameType || currentGameType;
    const maxPossibleHits = gameType === 'polla' ? 6 : 3;

    // Estilo para el ganador principal (3 aciertos en micro, 6 en polla)
    if (winningNumbers.size > 0 && hits === maxPossibleHits && hits > 0) {
        bgColor = 'rgba(2, 255, 0)'; // Verde brillante para el ganador
        textColor = 'black';
        rowBgColor = 'rgba(2, 255, 0, 0.15)';
    } 
    // Estilos intermedios solo para POLLA
    else if (gameType === 'polla') {
        switch (hits) {
            case 5:
                bgColor = 'rgb(18, 117, 251)';
                rowBgColor = 'rgba(18, 117, 251, 0.15)';
                break;
            case 4:
                bgColor = 'rgb(0, 119, 182)';
                rowBgColor = 'rgba(0, 119, 182, 0.15)';
                break;
            case 3:
                bgColor = 'rgb(3, 179, 216)';
                rowBgColor = 'rgba(3, 179, 216, 0.15)';
                break;
            case 2:
                bgColor = 'rgb(74, 202, 229)';
                textColor = 'black';
                rowBgColor = 'rgba(74, 202, 229, 0.15)';
                break;
            case 1:
                bgColor = 'rgb(145, 224, 240)';
                textColor = 'black';
                rowBgColor = 'rgba(145, 224, 240, 0.2)';
                break;
        }
    }
    // Estilos para MICRO (2 y 1 aciertos) — acentuar ligeramente el fondo
    else if (gameType === 'micro') {
        switch (hits) {
            case 2:
                // Navy ligeramente más intenso para mejor contraste (leve aumento)
                bgColor = 'rgb(3, 179, 216)';
                rowBgColor = 'rgba(3, 179, 216, 0.15)';
                break;
            case 1:
                // Azul claro un poco más saturado
                bgColor = 'rgb(145, 224, 240)';
                textColor = 'black';
                rowBgColor = 'rgba(145, 224, 240, 0.2)';
                break;
            default:
                break; // 0 aciertos: sin color
        }
    }

    // Aplicar estilos si se definió un color
    if (bgColor && hitsCell) {
        row.style.backgroundColor = rowBgColor;
        hitsCell.style.backgroundColor = bgColor;
        hitsCell.style.color = textColor;
        hitsCell.classList.add('rounded', 'font-bold');
    } else if (hitsCell) {
        // Estilo por defecto para 0 aciertos o para micro sin ser ganador
        hitsCell.classList.add('bg-gray-200', 'rounded');
    }
}


// Función para reordenar las filas de la tabla
function reorderTableRows() {
    const tableBody = getCurrentTableBody();
    const rows = Array.from(tableBody.querySelectorAll('tr'));
    const currentPlayers = currentGameType === 'polla' ? pollaPlayers : microPlayers;
    
    // Crear array de filas con sus datos de jugador
    const rowsWithData = rows.map(row => {
        const cells = row.cells;
        const playerId = parseInt(row.dataset.rowId, 10);
        const player = currentPlayers.find(p => p.id === playerId);
        return {
            row: row,
            player: player,
            hits: player ? player.hits : 0
        };
    });
    
    // Ordenar por aciertos (descendente)
    rowsWithData.sort((a, b) => {
        if (a.hits !== b.hits) {
            return b.hits - a.hits;
        }
        // Si tienen los mismos aciertos, mantener orden original
        return 0;
    });
    
    // Reorganizar filas en el DOM
    rowsWithData.forEach(item => {
        tableBody.appendChild(item.row);
    });
}

// Función para limpiar selecciones
async function clearSelections() {
    // Limpiar UI
    document.querySelectorAll('.number-cell').forEach(cell => {
        cell.classList.remove('selected', 'ring-yellow-400', 'transform', 'scale-110', 'bg-yellow-300', 'text-black');
    });
    
    // Limpiar en memoria
    winningNumbers.clear();
    
    // Actualizar en la base de datos
    await updateWinningNumbersInDB();
    
    // Actualizar la tabla de jugadores
    updatePlayersTable();
    console.log('Números ganadores limpiados correctamente');
}

// Función para actualizar display con debounce
const updateDisplay = debounce(() => {
    if (PERF_CONFIG.batchUpdates) {
        requestAnimationFrame(updateCalculatedStats);
    } else {
        updateCalculatedStats();
    }
}, PERF_CONFIG.debounceTime);

// ===== FUNCIONES PARA MODALES =====

// Abrir modal de reiniciar jugadas
function openResetPlaysModal() {
    document.getElementById('resetPlaysModal').classList.remove('hidden');
}

// Cerrar modal de limpiar pote
function closeClearPotModal() {
    document.getElementById('clearPotModal').classList.add('hidden');
}

// Mostrar modal de limpiar pote
function openClearPotModal() {
    document.getElementById('clearPotModal').classList.remove('hidden');
}

// Confirmar limpiar pote
async function confirmClearPot() {
    try {
        // Aquí iría la lógica para limpiar el pote
        // Por ahora, solo cerramos el modal y mostramos un mensaje
        closeClearPotModal();
        showToast('✅ Pote limpiado exitosamente', 'success');
        
        // Actualizar la interfaz según sea necesario
        document.getElementById('totalPotValue').textContent = '0';
        
        // Limpiar los campos de días
        document.querySelectorAll('input[data-day]').forEach(input => {
            input.value = '';
        });
    } catch (error) {
        console.error('Error al limpiar el pote:', error);
        showToast('❌ Error al limpiar el pote', 'error');
    }
}

// Cerrar modal de limpiar selección
function closeClearSelectionModal() {
    document.getElementById('clearSelectionModal').classList.add('hidden');
}

// Mostrar modal de limpiar selección
function openClearSelectionModal() {
    document.getElementById('clearSelectionModal').classList.remove('hidden');
}

// Confirmar limpiar selección
async function confirmClearSelection() {
    try {
        closeClearSelectionModal();
        await clearSelections();
        showToast('✅ Selección limpiada exitosamente', 'success');
    } catch (error) {
        console.error('Error al limpiar la selección:', error);
        showToast('❌ Error al limpiar la selección', 'error');
    }
}

// Cerrar modal de reiniciar jugadas
function closeResetPlaysModal() {
    document.getElementById('resetPlaysModal').classList.add('hidden');
}

// Confirmar y ejecutar reinicio de jugadas
async function confirmResetPlays() {
    const confirmBtn = document.querySelector('#resetPlaysModal button[onclick="confirmResetPlays()"]');
    const originalText = confirmBtn.innerHTML;
    
    try {
        // Mostrar indicador de carga
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Procesando...';
        
        // Llamar a la función de reset en supabase-config.js
        const response = await window.resetAllGameData();
        
        if (response && response.success) {
            // Cerrar el modal inmediatamente
            closeResetPlaysModal();
            
            // Limpiar las tablas y regenerar filas vacías
            const tableBody = currentGameType === 'polla' ? 
                document.getElementById('pollaTableBody') : 
                document.getElementById('microTableBody');
            
            // Limpiar la tabla actual
            tableBody.innerHTML = '';
            
            // Reiniciar el array de jugadores
            if (currentGameType === 'polla') {
                pollaPlayers = [];
                generatePollaTableRows(); // Regenerar filas vacías
            } else {
                microPlayers = [];
                generateMicroTableRows(); // Regenerar filas vacías
            }
            
            // Mostrar mensaje de éxito
            showToast('✅ ¡Todas las jugadas han sido reiniciadas exitosamente!', 'success');
            
            // Actualizar la interfaz
            updatePlaysCounter();
            updateCalculatedStats();
            updateDisplay();
            
            // Forzar actualización de la vista
            requestAnimationFrame(() => {
                // Actualizar la tabla actual
                if (currentGameType === 'polla') {
                    updatePollaTable();
                } else {
                    updateMicroTable();
                }
                
                // Forzar un redibujado del navegador
                setTimeout(() => {
                    tableBody.style.display = 'none';
                    tableBody.offsetHeight; // Trigger reflow
                    tableBody.style.display = '';
                    
                    // Actualizar contadores nuevamente para asegurar consistencia
                    updatePlaysCounter();
                    updateCalculatedStats();
                }, 50);
            });
        } else {
            throw new Error(response?.error || 'Error al reiniciar las jugadas');
        }
    } catch (error) {
        console.error('Error al reiniciar jugadas:', error);
        showToast('Ocurrió un error al reiniciar las jugadas: ' + (error.message || 'Error desconocido'), 'error');
    } finally {
        const confirmBtn = document.querySelector('#resetPlaysModal button[onclick="confirmResetPlays()"]');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = originalText;
        }
    }
}

// Abrir modal de agregar jugador
function openAddPlayerModal() {
    document.getElementById('addPlayerModal').classList.remove('hidden');
    updatePlayerNameField();
}

// Cerrar modal de agregar jugador
function closeAddPlayerModal() {
    document.getElementById('addPlayerModal').classList.add('hidden');
    document.getElementById('addPlayerForm').reset();
}

// Abrir modal de gestión de jugadores
function openPlayerManagerModal() {
    updatePlayersList();
    document.getElementById('playerManagerModal').classList.remove('hidden');
}

// Cerrar modal de gestión de jugadores
function closePlayerManagerModal() {
    document.getElementById('playerManagerModal').classList.add('hidden');
}

// ===== FUNCIONES PARA PERSISTENCIA DE DATOS =====
// Cargar los números ganadores desde Supabase y marcarlos en el tablero
async function loadWinnersFromSupabase() {
    const dbManager = currentGameType === 'polla' ? ResultadosNumerosDB : ResultadosMicroDB;

    if (dbManager && dbManager.obtenerUltimo) {
        // Primero, limpiar el estado visual y en memoria
        winningNumbers.clear();
        const numberCells = document.querySelectorAll('.number-cell');
        numberCells.forEach(cell => {
            cell.classList.remove('text-black', 'selected', 'ring-yellow-400', 'transform', 'scale-110', 'bg-yellow-300');
            cell.classList.add('text-white')
        });

        const res = await dbManager.obtenerUltimo();

        // Si se encontraron datos, aplicarlos
        if (res.success && res.data && Array.isArray(res.data.numeros_ganadores)) {
            const nums = res.data.numeros_ganadores.map(String); // Asegurar que sean strings
            
            nums.forEach(n => winningNumbers.add(n));
            
            // Marcar visualmente los números ganadores
            numberCells.forEach(cell => {
                if (winningNumbers.has(cell.textContent.trim())) {
                    cell.classList.remove('text-white');
                    cell.classList.add('selected', 'ring-yellow-400', 'transform', 'scale-110', 'bg-yellow-300', 'text-black');
                }
            });
        }
        // Actualizar la tabla de jugadores para reflejar los aciertos (o la falta de ellos)
        updatePlayersTable();
    }
}


// Cargar todos los tickets/jugadas desde Supabase y poblar la tabla
async function loadTicketsFromSupabase() {
    const dbManager = currentGameType === 'polla' ? JugadasPollaDB : JugadasMicroDB;

    if (dbManager && dbManager.obtenerTodas) {
        // Limpiar estado de jugadores en memoria antes de cargar
        const targetPlayersArray = currentGameType === 'polla' ? pollaPlayers : microPlayers;
        targetPlayersArray.length = 0;

        const res = await dbManager.obtenerTodas();

        const tableBody = getCurrentTableBody();
        const rows = tableBody.querySelectorAll('tr');

        const numCount = currentGameType === 'polla' ? 6 : 3;
        const gratisCellIndex = 2 + numCount;
        const hitsCellIndex = gratisCellIndex + 1;

        // Limpiar UI de las filas antes de cargar nuevos datos
        rows.forEach(row => {
            const cells = row.cells;
            // Limpiar celdas de datos, manteniendo el número de fila y el botón de acción (última celda)
            for (let i = 1; i < cells.length - 1; i++) {
                if (i === hitsCellIndex) {
                    cells[i].textContent = '0';
                } else if (i === gratisCellIndex) {
                    cells[i].textContent = 'NO';
                    cells[i].classList.remove('text-green-600', 'font-bold');
                } else {
                    cells[i].textContent = '';
                }
            }

            cells[hitsCellIndex].setAttribute('data-hits', '0');
            row.removeAttribute('data-db-id');
            applyHitsColors(row, 0, currentGameType);
        });

        if (res.success && Array.isArray(res.data)) {
            // Ordenar por ID para asegurar un orden consistente
            res.data.sort((a, b) => a.id - b.id);

            res.data.forEach((ticketData, index) => {
                if (ticketData.nombre_jugador && index < rows.length) {
                    const row = rows[index]; // La fila <tr>
                    const cells = row.cells; // La colección de <td>

                    // Poblar la UI
                    cells[1].textContent = ticketData.nombre_jugador || '';
                    for (let i = 1; i <= numCount; i++) {
                        cells[i + 1].textContent = ticketData[`nro_${i}`] || '';
                    }

                    // Poblar celda 'Gratis'
                    const gratisCell = cells[gratisCellIndex];
                    if (gratisCell) {
                        const isGratis = ticketData.gratis || false;
                        gratisCell.textContent = isGratis ? 'SÍ' : 'NO';
                        gratisCell.classList.toggle('text-green-600', isGratis);
                        gratisCell.classList.toggle('font-bold', isGratis);
                    }

                    // Poblar el array de jugadores en memoria, incluyendo 'gratis' y 'dbId'
                    updatePlayerData(row, ticketData.gratis, ticketData.id, false); // false para no guardar
                }
            });
        }
        // Actualizar contadores y aciertos después de cargar todos los datos
        updatePlaysCounter();
        updatePlayersTable();
    }
}

// (Eliminado: la base de datos de jugadores ahora solo se gestiona en Supabase)

// Función para limpiar todos los datos guardados
// (Eliminada: ya no se usa localStorage para ningún dato principal)

// ===== FUNCIONES PARA GESTIÓN DE JUGADORES =====
// Eliminar jugada/ticket de Supabase por id
async function removeTicketFromSupabase(ticketId) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta jugada?')) return;
    if (typeof JugadasPollaDB !== 'undefined' && JugadasPollaDB.eliminar) {
        const res = await JugadasPollaDB.eliminar(ticketId);
        if (res.success) {
            await loadTicketsFromSupabase();
            updateCalculatedStats();
        } else {
            showToast('Error al eliminar jugada: ' + (res.error || 'Error desconocido'), 'error');
        }
    }
}


// Agregar jugador a la base de datos Supabase
async function addPlayerToDatabase() {
    const nameInput = document.getElementById('newPlayerName');
    const name = nameInput.value.trim();
    if (!name) {
        showToast('Por favor ingresa un nombre', 'error');
        return;
    }
    // Verificar si el jugador ya existe en Supabase
    if (typeof JugadoresDB !== 'undefined' && JugadoresDB.buscarPorNombre) {
        const res = await JugadoresDB.buscarPorNombre(name);
        if (res.success && res.data) {
            showToast('Este jugador ya existe en la base de datos', 'error');
            return;
        }
    }
    // Agregar a Supabase
    if (typeof JugadoresDB !== 'undefined' && JugadoresDB.crear) {
        const res = await JugadoresDB.crear(name);
        if (res.success) {
            nameInput.value = '';
            await updatePlayersList();
            showToast('Jugador agregado exitosamente!', 'success');
        } else {
            showToast('Error al agregar jugador: ' + (res.error || 'Error desconocido'), 'error');
        }
    }
}

// Eliminar jugador de la base de datos Supabase
async function removePlayerFromDatabase(playerName) {
    if (!confirm(`¿Estás seguro de que quieres eliminar a ${playerName}?`)) return;
    // Buscar el jugador en Supabase para obtener el id
    if (typeof JugadoresDB !== 'undefined' && JugadoresDB.buscarPorNombre && JugadoresDB.eliminar) {
        const res = await JugadoresDB.buscarPorNombre(playerName);
        if (res.success && res.data && res.data.id) {
            const del = await JugadoresDB.eliminar(res.data.id);
            if (del.success) {
                await updatePlayersList();
            } else {
                showToast('Error al eliminar jugador: ' + (del.error || 'Error desconocido'), 'error');
            }
        } else {
            showToast('No se encontró el jugador en la base de datos', 'error');
        }
    }
}

// Actualizar lista de jugadores desde Supabase
async function updatePlayersList() {
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = '';
    if (typeof JugadoresDB !== 'undefined' && JugadoresDB.obtenerTodos) {
        const res = await JugadoresDB.obtenerTodos();
        if (res.success && Array.isArray(res.data)) {
            res.data.forEach(player => {
                const playerItem = document.createElement('div');
                playerItem.className = 'flex justify-between items-center p-2 bg-gray-100 rounded';
                playerItem.innerHTML = `
                    <span class="font-medium">${player.nombre}</span>
                    <button onclick="removePlayerFromDatabase('${player.nombre}')" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition-colors">
                        ELIMINAR
                    </button>
                `;
                playersList.appendChild(playerItem);
            });
        }
    }
}

// Variables para autocompletado
let currentAutocompleteIndex = -1;
let filteredPlayers = [];
let allPlayersSupabase = [];

// Actualizar el campo de nombre con autocompletado
function updatePlayerNameField() {
    const nameInput = document.getElementById('playerName');
    if (nameInput) {
        const suggestionsContainer = document.getElementById('autocompleteList');

        // Evitar enlazar listeners múltiples veces
        if (!nameInput.dataset.autocompleteBound) {
            nameInput.addEventListener('input', (e) => handleAutocompleteInput(e.target, suggestionsContainer));
            nameInput.addEventListener('keydown', (e) => handleAutocompleteKeydown(e, e.target, suggestionsContainer));
            nameInput.addEventListener('blur', () => setTimeout(() => hideAutocomplete(suggestionsContainer), 200));
            nameInput.dataset.autocompleteBound = '1';
        }

        // Cargar la lista de jugadores (si no está ya cargada)
        if (!allPlayersSupabase || allPlayersSupabase.length === 0) {
            // Llamada a la función global que obtiene jugadores desde JugadoresDB/Supabase
            loadAllPlayersForAutocomplete().catch(err => console.error('Error cargando jugadores para autocomplete:', err));
        }
    }
}

// Cargar todos los jugadores desde la base de datos (Supabase) en una variable global
async function loadAllPlayersForAutocomplete() {
    try {
        if (typeof JugadoresDB !== 'undefined' && JugadoresDB.obtenerTodos) {
            const res = await JugadoresDB.obtenerTodos();
            if (res.success && Array.isArray(res.data)) {
                allPlayersSupabase = res.data.map(p => p.nombre);
            } else {
                allPlayersSupabase = [];
            }
        } else {
            // Si no hay JugadoresDB (por ejemplo en desarrollo local), dejar el array vacío
            allPlayersSupabase = [];
        }
    } catch (error) {
        console.error('loadAllPlayersForAutocomplete error:', error);
        allPlayersSupabase = [];
    }
}

// Manejar input del campo de nombre
function handleAutocompleteInput(inputElement, suggestionsContainer) {
    const query = inputElement.value.toLowerCase().trim();
    
    if (query.length === 0) {
        hideAutocomplete(suggestionsContainer);
        return;
    }
    
    // Filtrar jugadores que coincidan desde Supabase
    // Priorizar prefijos (startsWith) y luego includes; limitar a 7 sugerencias
    const lower = query;
    const starts = [];
    const contains = [];
    for (const player of allPlayersSupabase) {
        const pLower = player.toLowerCase();
        if (pLower.startsWith(lower)) {
            starts.push(player);
        } else if (pLower.includes(lower)) {
            contains.push(player);
        }
    }
    // Orden: prefijos (alfabético), luego contains (alfabético)
    starts.sort((a,b) => a.localeCompare(b));
    contains.sort((a,b) => a.localeCompare(b));
    filteredPlayers = starts.concat(contains).slice(0, 7); // Limitar a 7
    // Mostrar la lista (incluso si está vacía) para que showAutocomplete pueda mostrar "Sin resultados"
    showAutocomplete(filteredPlayers, query, inputElement, suggestionsContainer);
}

// Mostrar lista de autocompletado
function showAutocomplete(players, query, inputElement, suggestionsContainer) {
    suggestionsContainer.innerHTML = '';
    
    players.forEach((player, index) => {
        const item = document.createElement('div');
        // Agregar clases Tailwind para transición y desplazamiento al pasar/activar
        item.className = 'p-2 hover:bg-blue-100 cursor-pointer border-b border-gray-200 transform transition-transform duration-150 ease-in-out hover:translate-x-2 active:translate-x-2 autocomplete-item';
        item.innerHTML = highlightMatch(player, query);
        item.addEventListener('mousedown', (e) => { // Use mousedown to fire before blur
            e.preventDefault();
            // Si el input está dentro de una celda de tabla, pasamos un callback para guardar la fila
            let onSelect = null;
            const cell = inputElement.closest('td');
            if (cell && cell.parentElement && cell.parentElement.tagName === 'TR') {
                const row = cell.parentElement;
                onSelect = (playerName, inputEl) => {
                    // Poner el valor en la celda y guardar
                    cell.textContent = playerName;
                    updatePlayerData(row);
                    updatePlayersTable();
                    saveRowData(row);
                };
            }
            selectAutocompleteItem(player, inputElement, suggestionsContainer, onSelect);
        });
        suggestionsContainer.appendChild(item);
    });
    // Si no hay resultados, mostrar un item indicativo
    if (!players || players.length === 0) {
        const none = document.createElement('div');
        none.className = 'p-2 text-gray-500 italic text-sm border-b border-gray-200';
        none.textContent = 'Sin resultados';
        suggestionsContainer.appendChild(none);
    }
    
    suggestionsContainer.classList.remove('hidden');
    currentAutocompleteIndex = -1;
}

// Ocultar lista de autocompletado
function hideAutocomplete(suggestionsContainer) {
    if (suggestionsContainer) {
        suggestionsContainer.classList.add('hidden');
        suggestionsContainer.innerHTML = '';
    }
    currentAutocompleteIndex = -1;
}

// Seleccionar item del autocompletado
function selectAutocompleteItem(playerName, inputElement, suggestionsContainer, onSelect) {
    inputElement.value = playerName;
    hideAutocomplete(suggestionsContainer);
    // Ejecutar callback opcional (por ejemplo, para guardar fila de tabla)
    try {
        if (typeof onSelect === 'function') onSelect(playerName, inputElement);
    } catch (err) {
        console.error('onSelect callback error:', err);
    }
    // Trigger blur to save the data (si no se manejó en el callback)
    inputElement.blur();
}

// Resaltar coincidencias en el texto
function highlightMatch(text, query) {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<strong class="text-blue-600">$1</strong>');
}

// Manejar teclas en el campo de nombre
function handleAutocompleteKeydown(e, inputElement, suggestionsContainer) {
    const items = suggestionsContainer.querySelectorAll('div');
    
    if (suggestionsContainer.classList.contains('hidden') || items.length === 0) {
        return;
    }
    
    switch(e.key) {
        case 'ArrowDown':
            e.preventDefault();
            currentAutocompleteIndex = Math.min(currentAutocompleteIndex + 1, items.length - 1);
            updateAutocompleteSelection(items);
            break;
        case 'ArrowUp':
            e.preventDefault();
            currentAutocompleteIndex = Math.max(currentAutocompleteIndex - 1, -1);
            updateAutocompleteSelection(items);
            break;
        case 'Enter':
            e.preventDefault();
            if (currentAutocompleteIndex >= 0 && currentAutocompleteIndex < items.length) {
                const selectedPlayer = filteredPlayers[currentAutocompleteIndex];
                // Si el input pertenece a una celda de tabla, pasar callback para guardar
                let onSelect = null;
                const cell = inputElement.closest('td');
                if (cell && cell.parentElement && cell.parentElement.tagName === 'TR') {
                    const row = cell.parentElement;
                    onSelect = (playerName, inputEl) => {
                        cell.textContent = playerName;
                        updatePlayerData(row);
                        updatePlayersTable();
                        saveRowData(row);
                    };
                }
                selectAutocompleteItem(selectedPlayer, inputElement, suggestionsContainer, onSelect);
            }
            break;
        case 'Escape':
            hideAutocomplete(suggestionsContainer);
            break;
    }
}

// Actualizar selección visual del autocompletado
function updateAutocompleteSelection(items) {
    items.forEach((item, index) => {
        if (index === currentAutocompleteIndex) {
            item.classList.add('bg-blue-100');
        } else {
            item.classList.remove('bg-blue-100');
        }
    });
}

// Agregar jugador desde el formulario
async function addPlayerFromForm() {
    const isPolla = currentGameType === 'polla';
    const numCount = isPolla ? 6 : 3;

    const name = document.getElementById('playerName').value.trim();
    const numbers = [];
    for (let i = 1; i <= numCount; i++) {
        numbers.push(document.getElementById(`number${i}`).value.trim());
    }
    const gratis = document.getElementById('gratis').value;
    
    // Validar que todos los campos estén llenos
    if (!name) return showToast('Por favor ingresa el nombre del jugador', 'error');
    
    // Validar números
    const validNumbers = ['0', '00', ...Array.from({ length: 36 }, (_, i) => (i + 1).toString())];
    for (let i = 0; i < numCount; i++) {
        if (!numbers[i]) return showToast(`Por favor ingresa el número ${i + 1}`, 'error');
        if (!validNumbers.includes(numbers[i])) return showToast(`El número ${numbers[i]} no es válido.`, 'error');
    }
    
    // Validar números únicos
    if (new Set(numbers).size !== numCount) return showToast('No puedes repetir números.', 'error');
    
    // Encontrar la primera fila vacía
    const tableBody = getCurrentTableBody();
    const rows = tableBody.querySelectorAll('tr');
    let targetRow = null;
    for (const row of rows) {
        if (row.cells[1].textContent.trim() === '') {
            targetRow = row;
            break;
        }
    }

    if (!targetRow) {
        return showToast('No hay filas vacías disponibles. La tabla está llena.', 'error');
    }

    // Poblar la fila de la UI
    const cells = targetRow.cells;
    cells[1].textContent = name;
    numbers.forEach((num, i) => {
        cells[2 + i].textContent = num;
    });
    const gratisCell = cells[2 + numCount];
    gratisCell.textContent = gratis;
    gratisCell.classList.toggle('text-green-600', gratis === 'SÍ');
    gratisCell.classList.toggle('font-bold', gratis === 'SÍ');

    // Actualizar el estado local y guardar en la base de datos
    updatePlayerData(targetRow, gratis === 'SÍ', null);
    await saveRowData(targetRow);

    // Actualizar aciertos y colores
    updatePlayersTable();

    // Si el nombre del jugador es nuevo, agregarlo a la lista de jugadores
    if (typeof JugadoresDB !== 'undefined' && !allPlayersSupabase.includes(name)) {
        await JugadoresDB.crear(name);
        await loadAllPlayersForAutocomplete(); // Recargar la lista para autocompletado
    }

    closeAddPlayerModal();
}

// Configurar el formulario
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('addPlayerForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            addPlayerFromForm().catch(err => console.error("Error en addPlayerFromForm:", err));
        });
    }
});

// Exportar funciones para uso global
window.openAddPlayerModal = openAddPlayerModal;
window.closeAddPlayerModal = closeAddPlayerModal;
window.openPlayerManagerModal = openPlayerManagerModal;
window.closePlayerManagerModal = closePlayerManagerModal;
window.addPlayerToDatabase = addPlayerToDatabase;
window.removePlayerFromDatabase = removePlayerFromDatabase;
window.resetAll = resetAll;
window.clearCurrentPot = clearCurrentPot;
window.deletePlay = deletePlay;
