// Variables globales
let playsCount = 0;
let winnersCount = 0;
let prizesToDistribute = 0;
let winningNumbers = new Set(); // Números ganadores seleccionados
let players = []; // Array para almacenar datos de jugadores
let playersDatabase = []; // Base de datos local de nombres de jugadores
let ticketsDatabase = []; // Base de datos local de tickets/jugadas

// Inicialización cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    initializeGame();
    setupEventListeners();
    updateDisplay();
    
    // Botón para guardar números ganadores seleccionados
    const saveWinnersBtn = document.getElementById('saveWinningNumbers');
    if (saveWinnersBtn) {
        saveWinnersBtn.addEventListener('click', saveWinningNumbersToSupabase);
    }

    // Botón para limpiar números ganadores
    const clearBtn = document.getElementById('clearWinningNumbers');
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            if (!confirm('¿Estás seguro de que quieres limpiar los números ganadores? Esto los eliminará de la base de datos.')) return;
            const msg = document.getElementById('winnersMsg');
            const res = await ResultadosNumerosDB.eliminarUltimo();
            
            // El reseteo es exitoso incluso si no había nada que borrar
            if (res.success || res.error === 'No hay resultado para eliminar') {
                await loadWinnersFromSupabase(); // Recargar para mostrar el estado limpio
                msg.textContent = 'Números ganadores limpiados.';
                msg.className = 'text-green-600 text-center text-sm mb-4';
            } else {
                msg.textContent = 'Error al limpiar: ' + res.error;
                msg.className = 'text-red-600 text-center text-sm mb-4';
            }
            
            setTimeout(() => {
                if (msg) msg.textContent = '';
            }, 3000);
        });
    }

    // Botón para guardar cambios en la tabla
    const saveBtn = document.getElementById('saveTableButton');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveTableDataToSupabase);
    }
});

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
    prizesToDistribute = 0;
    prizeAmount = 0;

    // Generar filas iniciales de la tabla
    generateInitialTableRows();
    
    // Cargar datos guardados desde Supabase (tickets/jugadas, ganadores y stats)
    await loadTicketsFromSupabase();
    await loadWinnersFromSupabase();
    // Cargar lista de jugadores desde Supabase en el modal si está abierto
    if (document.getElementById('playerManagerModal') && !document.getElementById('playerManagerModal').classList.contains('hidden')) {
        updatePlayersList();
    }
    
    // Marcar día actual
    highlightCurrentDay();
}

// Función para generar filas iniciales de la tabla
function generateInitialTableRows() {
    const tableBody = document.getElementById('playersTableBody');
    tableBody.innerHTML = ''; // Limpiar tabla existente
    
    // Generar 500 filas iniciales
    for (let i = 1; i <= 500; i++) {
        const row = document.createElement('div');
        row.className = 'grid grid-cols-9 gap-2 p-2 text-center text-sm hover:bg-gray-50 border-b border-gray-100';
        row.innerHTML = `
            <div class="p-2 font-bold">${i}</div>
            <div class="p-2 text-left cursor-pointer hover:bg-gray-100 rounded" data-editable="name"></div>
            <div class="p-2 cursor-pointer hover:bg-gray-100 rounded" data-editable="number" data-index="0"></div>
            <div class="p-2 cursor-pointer hover:bg-gray-100 rounded" data-editable="number" data-index="1"></div>
            <div class="p-2 cursor-pointer hover:bg-gray-100 rounded" data-editable="number" data-index="2"></div>
            <div class="p-2 cursor-pointer hover:bg-gray-100 rounded" data-editable="number" data-index="3"></div>
            <div class="p-2 cursor-pointer hover:bg-gray-100 rounded" data-editable="number" data-index="4"></div>
            <div class="p-2 cursor-pointer hover:bg-gray-100 rounded" data-editable="number" data-index="5"></div>
            <div class="p-2 font-bold" data-hits="0">0</div>
        `;
        
        // Configurar eventos para la fila
        setupRowEvents(row);
        tableBody.appendChild(row);
    }
    
    console.log('500 filas generadas inicialmente');
}

// Configurar eventos para una fila
function setupRowEvents(row) {
    const editableCells = row.querySelectorAll('[data-editable]');
    editableCells.forEach(cell => {
        cell.addEventListener('click', function() {
            makeCellEditable(this, row);
        });
    });
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

// Función para actualizar el total del pote
function updateTotalPot() {
    const dayInputs = document.querySelectorAll('input[data-day]');
    let total = 0;
    
    dayInputs.forEach(input => {
        const value = parseInt(input.value) || 0;
        total += value;
    });
    
    document.getElementById('totalPotValue').textContent = total;
}

// Función para resetear toda la app
async function resetAll() {
    if (!confirm('¿Estás seguro de que quieres resetear todo el juego? Esto borrará TODAS las jugadas, resultados y marcadores de la base de datos y reiniciará los contadores de ID.')) {
        return;
    }

    // 1. Llamar a la función RPC para truncar las tablas en la BD
    if (typeof resetAllGameData === 'function') {
        console.log('Reseteando datos en la base de datos...');
        const res = await resetAllGameData();
        if (!res.success) {
            alert('Error al resetear los datos del juego: ' + (res.error || 'Error desconocido'));
            return; // Detener si el reseteo de la BD falla
        }
    } else {
        alert('Error crítico: no se pudo encontrar la función de reseteo.');
        return;
    }

    // 2. Resetear el estado de la UI y la memoria

    // Resetear números ganadores visualmente y en memoria
    winningNumbers.clear();
    const numberCells = document.querySelectorAll('.number-cell.selected');
    numberCells.forEach(cell => {
        cell.classList.remove('selected', 'ring-4', 'ring-yellow-400', 'transform', 'scale-110', 'bg-yellow-300', 'text-black');
    });

    // Resetear datos de jugadores en memoria
    players = [];

    // Resetear marcadores de días
    document.querySelectorAll('input[data-day]').forEach(input => {
        input.value = '';
    });
    updateTotalPot();

    // Recargar datos desde las tablas ahora vacías para limpiar la UI
    await loadTicketsFromSupabase();
    await loadWinnersFromSupabase(); // Esto también llama a updatePlayersTable

    alert('¡Todos los datos del juego han sido reseteados exitosamente!');
}

// Función para seleccionar un número ganador
function selectNumber(cell) {
    const number = cell.textContent.trim();

    // Si la celda ya está seleccionada, no hacer nada para evitar deselección accidental.
    // Los números se mantienen marcados como solicitó el usuario.
    // Para cambiar, usar el formulario manual o el botón LIMPIAR.
    if (cell.classList.contains('selected')) {
        return;
    }

    cell.classList.add('selected', 'ring-4', 'ring-yellow-400', 'transform', 'scale-110', 'bg-yellow-300', 'text-black');
    winningNumbers.add(number);
    
    updatePlayersTable(); // Actualizar tabla en tiempo real
}

// Función para guardar los números ganadores seleccionados en Supabase
async function saveWinningNumbersToSupabase() {
    const msg = document.getElementById('winnersMsg');
    if (winningNumbers.size === 0) {
        msg.textContent = 'No has seleccionado ningún número para guardar.';
        msg.className = 'text-yellow-600 text-center text-sm mb-4';
        return;
    }

    const nums = Array.from(winningNumbers);

    if (typeof ResultadosNumerosDB !== 'undefined' && ResultadosNumerosDB.crear && ResultadosNumerosDB.eliminarUltimo) {
        // Para evitar duplicados, siempre eliminamos el último registro antes de crear uno nuevo.
        ResultadosNumerosDB.eliminarUltimo().finally(async () => {
            const res = await ResultadosNumerosDB.crear(nums);
            if (res.success) {
                msg.textContent = '¡Números ganadores guardados correctamente!';
                msg.className = 'text-green-600 text-center text-sm mb-4';
                // Recargar para confirmar que se guardó y la UI está sincronizada.
                await loadWinnersFromSupabase();
            } else {
                msg.textContent = 'Error al guardar en Supabase: ' + (res.error || 'Error desconocido');
                msg.className = 'text-red-600 text-center text-sm mb-4';
            }
            
            setTimeout(() => {
                if (msg) msg.textContent = '';
            }, 3000);
        });
    } else {
        msg.textContent = 'No se encontró la función para guardar en Supabase.';
        msg.className = 'text-red-600 text-center text-sm mb-4';
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

// Función para hacer una celda editable
function makeCellEditable(cell, row) {
    // Evitar múltiples ediciones simultáneas
    if (cell.querySelector('input')) {
        return;
    }

    const currentValue = cell.textContent.trim();
    const isNumberCell = cell.hasAttribute('data-editable') && cell.getAttribute('data-editable') === 'number';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentValue;
    input.className = 'w-full text-center border border-blue-300 rounded px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

    // Limpiar la celda y agregar el input
    cell.innerHTML = '';
    cell.appendChild(input);

    // Enfocar y seleccionar el texto inmediatamente
    setTimeout(() => {
        input.focus();
        input.select();
    }, 0);

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
            if (validateNumberInput(input)) {
                cell.textContent = input.value;
                // Validar números únicos después de establecer el valor
                if (validateUniqueNumbers(row, cell)) {
                    updatePlayerData(row);
                }
            } else {
                cell.textContent = currentValue;
            }
        } else {
            cell.textContent = input.value;
            updatePlayerData(row);
        }
    });

    // Manejar tecla Enter
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        }
    });

    // Manejar tecla Escape para cancelar
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            input.value = currentValue;
            input.blur();
        }
    });

    // Manejar Tab para pasar al siguiente input editable
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            // Buscar todas las celdas editables de la tabla
            const allRows = Array.from(document.querySelectorAll('#playersTableBody > .grid'));
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
function updatePlayerData(row) {
    const cells = row.children;
    const playerId = cells[0].textContent;
    const name = cells[1].textContent.trim();
    
    // Obtener los 6 números del jugador
    const playerNumbers = [];
    for (let i = 2; i <= 7; i++) {
        const number = cells[i].textContent.trim();
        if (number) {
            playerNumbers.push(number);
        }
    }
    
    // Verificar si la fila está completa (nombre + 6 números)
    const isComplete = name !== '' && playerNumbers.length === 6;
    
    // Actualizar o crear entrada del jugador
    const existingPlayerIndex = players.findIndex(p => p.id === playerId);
    const playerData = {
        id: playerId,
        name: name,
        numbers: playerNumbers,
        hits: 0,
        isComplete: isComplete
    };
    
    if (existingPlayerIndex >= 0) {
        players[existingPlayerIndex] = playerData;
    } else {
        players.push(playerData);
    }
    
    // Actualizar contador de jugadas solo con filas completas
    updatePlaysCounter();
    
    // Actualizar tabla completa
    updatePlayersTable();
    
    // Guardar datos automáticamente después de cada cambio
}

// Función para actualizar contador de jugadas
function updatePlaysCounter() {
    const completePlayers = players.filter(p => p.isComplete);
    playsCount = completePlayers.length;
    document.getElementById('playsCount').textContent = playsCount;
    document.getElementById('tableJugadas').textContent = playsCount;
    
    // Actualizar estadísticas calculadas
    updateCalculatedStats();
}

// Función para actualizar estadísticas calculadas
function updateCalculatedStats() {
    const valorJugada = 30;
    
    // Calcular TOTAL = JUGADAS × VALOR
    const total = playsCount * valorJugada;
    
    // Calcular -20% = TOTAL - (TOTAL × 0.20)
    const menos20Porciento = total - (total * 0.20);
    
    // Contar jugadores GRATIS
    const gratisCount = countGratisPlayers();
    
    // Calcular PREMIOS A REPARTIR = (-20%) ÷ (CANTIDAD DE GANADORES)
    const cantidadGanadores = countWinners();
    const premiosARepartir = cantidadGanadores > 0 ? Math.floor(menos20Porciento / cantidadGanadores) : 0;
    
    // Actualizar displays
    updateStatDisplay('total', total);
    updateStatDisplay('menos20', menos20Porciento);
    updateStatDisplay('gratis', gratisCount);
    updateStatDisplay('premios', premiosARepartir);
    updateStatDisplay('winners', cantidadGanadores);
}

// Función para contar ganadores (jugadores con 6 aciertos)
function countWinners() {
    const tableBody = document.getElementById('playersTableBody');
    const rows = tableBody.querySelectorAll('div.grid');
    let winnersCount = 0;
    
    rows.forEach(row => {
        const hitsCell = row.querySelector('[data-hits]');
        if (hitsCell && hitsCell.getAttribute('data-hits') === '6') {
            winnersCount++;
        }
    });
    
    return winnersCount;
}

// Función para contar jugadores GRATIS
function countGratisPlayers() {
    // Esta función necesitaría ser implementada según cómo se maneje el estado "gratis"
    // Por ahora retorna 0
    return 0;
}

// Función para actualizar display de estadísticas
function updateStatDisplay(statType, value) {
    const elements = {
        'total': document.getElementById('totalValue'),
        'menos20': document.getElementById('menos20Value'),
        'gratis': document.getElementById('gratisCount'),
        'premios': document.getElementById('prizesToDistribute'),
        'garantizado': document.getElementById('garantizadoValue'),
        'acumulado': document.getElementById('acumuladoValue'),
        'pote': document.getElementById('poteValue'),
        'winners': document.getElementById('winnersCount'),
        'prize': document.getElementById('prizeAmount')
    };
    
    if (elements[statType]) {
        elements[statType].textContent = value;
    }
}

// Función para actualizar la tabla de jugadores en tiempo real
function updatePlayersTable() {
    const tableBody = document.getElementById('playersTableBody');
    const rows = tableBody.querySelectorAll('div.grid');
    
    // Calcular aciertos para cada jugador
    players.forEach(player => {
        player.hits = 0;
        player.numbers.forEach(number => {
            if (winningNumbers.has(number)) {
                player.hits++;
            }
        });
    });
    
    // Actualizar filas existentes
    rows.forEach((row, index) => {
        const cells = row.children;
        const playerId = cells[0].textContent;
        const player = players.find(p => p.id === playerId);
        
        if (player) {
            // Actualizar aciertos
            const hitsCell = cells[8];
            hitsCell.textContent = player.hits;
            hitsCell.setAttribute('data-hits', player.hits);
            
            // Marcar números ganadores y aplicar colores
            for (let i = 2; i <= 7; i++) {
                const numberCell = cells[i];
                const number = numberCell.textContent.trim();
                
                // Limpiar clases anteriores
                numberCell.className = 'p-2 cursor-pointer hover:bg-gray-100 rounded';
                
                if (number && winningNumbers.has(number)) {
                    numberCell.classList.add('bg-green-500', 'text-white', 'font-bold');
                }
            }
            
            // Aplicar colores según el número de aciertos
            applyHitsColors(row, player.hits);
        }
    });
    
    // Reordenar filas según aciertos
    // reorderTableRows();
    
    // Actualizar estadísticas
    updateCalculatedStats();
}

// Función para aplicar colores según aciertos
function applyHitsColors(row, hits) {
    // Limpiar clases y estilos de color anteriores
    row.className = 'grid grid-cols-9 gap-2 p-2 text-center text-sm hover:bg-gray-50 border-b border-gray-100';
    row.style.backgroundColor = '';
    
    const cells = row.children;
    const hitsCell = cells[8];
    // Limpiar clases de la celda de aciertos
    hitsCell.className = 'p-2 font-bold';
    hitsCell.style.backgroundColor = '';
    hitsCell.style.color = '';

    let bgColor = '';
    let textColor = 'white'; // La mayoría de los colores de fondo son oscuros
    let rowBgColor = '';
    
    // Check for winner first (max possible hits)
    if (winningNumbers.size > 0 && hits === winningNumbers.size) {
        bgColor = 'rgba(2, 255, 0)';
        textColor = 'black';
        rowBgColor = 'rgba(2, 255, 0, 0.15)';
    } else {
        // Handle other cases
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
                textColor = 'black'; // Color claro
                rowBgColor = 'rgba(145, 224, 240, 0.2)';
                break;
            default:
                // 0 aciertos - Sin color especial
                hitsCell.classList.add('bg-gray-200', 'rounded');
                cells[0].textContent = cells[0].textContent.replace('G', '');
                return; // No más styling
        }
    }

    // Aplicar estilos
    if (bgColor) {
        row.style.backgroundColor = rowBgColor;
        hitsCell.style.backgroundColor = bgColor;
        hitsCell.style.color = textColor;
        hitsCell.classList.add('rounded', 'font-bold');
    }
    
    // Add 'G' for winner
    if (winningNumbers.size > 0 && hits === winningNumbers.size) {
        cells[0].textContent = 'G' + cells[0].textContent.replace('G', '');
    } else {
        cells[0].textContent = cells[0].textContent.replace('G', '');
    }
}

// Función para reordenar las filas de la tabla
function reorderTableRows() {
    const tableBody = document.getElementById('playersTableBody');
    const rows = Array.from(tableBody.querySelectorAll('div.grid'));
    
    // Crear array de filas con sus datos de jugador
    const rowsWithData = rows.map(row => {
        const cells = row.children;
        const playerId = cells[0].textContent.replace('G', '');
        const player = players.find(p => p.id === playerId);
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
function clearSelections() {
    const selectedNumbers = document.querySelectorAll('.number-cell.selected');
    selectedNumbers.forEach(cell => {
        cell.classList.remove('selected', 'ring-4', 'ring-yellow-400', 'transform', 'scale-110');
    });
    
    winningNumbers.clear();
    updatePlayersTable();
    console.log('Selecciones limpiadas');
}

// Función para actualizar display
function updateDisplay() {
    updateCalculatedStats();
}

// ===== FUNCIONES PARA MODALES =====

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
    loadPlayersDatabase();
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
    if (typeof ResultadosNumerosDB !== 'undefined' && ResultadosNumerosDB.obtenerUltimo) {
        // Primero, limpiar el estado visual y en memoria
        winningNumbers.clear();
        const numberCells = document.querySelectorAll('.number-cell');
        numberCells.forEach(cell => {
            cell.classList.remove('selected', 'ring-4', 'ring-yellow-400', 'transform', 'scale-110', 'bg-yellow-300', 'text-black');
        });

        const res = await ResultadosNumerosDB.obtenerUltimo();

        // Si se encontraron datos, aplicarlos
        if (res.success && res.data && Array.isArray(res.data.numeros_ganadores)) {
            const nums = res.data.numeros_ganadores.map(String); // Asegurar que sean strings
            
            nums.forEach(n => winningNumbers.add(n));
            
            // Marcar visualmente los números ganadores
            numberCells.forEach(cell => {
                if (winningNumbers.has(cell.textContent.trim())) {
                    cell.classList.add('selected', 'ring-4', 'ring-yellow-400', 'transform', 'scale-110', 'bg-yellow-300', 'text-black');
                }
            });
        }
        // Actualizar la tabla de jugadores para reflejar los aciertos (o la falta de ellos)
        updatePlayersTable();
    }
}


// Cargar todos los tickets/jugadas desde Supabase y poblar la tabla
async function loadTicketsFromSupabase() {
    if (typeof JugadasPollaDB !== 'undefined' && JugadasPollaDB.obtenerTodas) {
        const res = await JugadasPollaDB.obtenerTodas();
        if (res.success && Array.isArray(res.data)) {
            const tableBody = document.getElementById('playersTableBody');
            const rows = tableBody.querySelectorAll('div.grid');

            // Limpiar filas existentes antes de cargar nuevos datos
            rows.forEach(row => {
                const cells = row.children;
                for (let i = 1; i < cells.length - 1; i++) {
                    cells[i].textContent = '';
                }
                cells[cells.length - 1].textContent = '0';
                cells[cells.length - 1].setAttribute('data-hits', '0');
                row.removeAttribute('data-db-id');
                applyHitsColors(row, 0);
            });

            res.data.forEach((ticketData, index) => {
                if (index < rows.length) {
                    const row = rows[index];
                    row.dataset.dbId = ticketData.id; // Guardar el ID de la base de datos
                    const cells = row.children;
                    // Asignar datos
                    cells[0].textContent = ticketData.id; // Usar el ID real de la BD
                    cells[1].textContent = ticketData.nombre_jugador || '';
                    cells[2].textContent = ticketData.nro_1 || '';
                    cells[3].textContent = ticketData.nro_2 || '';
                    cells[4].textContent = ticketData.nro_3 || '';
                    cells[5].textContent = ticketData.nro_4 || '';
                    cells[6].textContent = ticketData.nro_5 || '';
                    cells[7].textContent = ticketData.nro_6 || '';
                    cells[8].textContent = '0';
                    cells[8].setAttribute('data-hits', '0');
                    if (ticketData.nombre_jugador) {
                        updatePlayerData(row);
                    }
                }
            });
        }
    }
}

// Guardar los datos de la tabla en Supabase
async function saveTableDataToSupabase() {
    if (!confirm('¿Estás seguro de que quieres guardar todos los cambios de la tabla en la base de datos?')) {
        return;
    }

    const rows = document.querySelectorAll('#playersTableBody .grid');
    const playsToInsert = [];
    const playsToUpdate = [];

    rows.forEach(row => {
        const cells = row.children;
        const name = cells[1].textContent.trim();
        const numbers = [];
        for (let i = 2; i <= 7; i++) {
            const num = cells[i].textContent.trim();
            if (num) numbers.push(num);
        }

        // Solo procesar filas completas (nombre y 6 números)
        if (name && numbers.length === 6) {
            const playData = {
                nombre_jugador: name,
                nro_1: numbers[0], nro_2: numbers[1], nro_3: numbers[2],
                nro_4: numbers[3], nro_5: numbers[4], nro_6: numbers[5],
            };

            const dbId = row.dataset.dbId;
            if (dbId) {
                playData.id = parseInt(dbId, 10);
                playsToUpdate.push(playData);
            } else {
                playsToInsert.push(playData);
            }
        }
    });

    try {
        let success = true;
        const errors = [];

        if (playsToInsert.length > 0) {
            const res = await JugadasPollaDB.crear(playsToInsert);
            if (!res.success) { success = false; errors.push(res.error); }
        }
        if (playsToUpdate.length > 0) {
            const res = await JugadasPollaDB.actualizar(playsToUpdate);
            if (!res.success) { success = false; errors.push(res.error); }
        }

        alert(success ? '¡Cambios guardados exitosamente!' : 'Ocurrieron errores al guardar:\n' + errors.join('\n'));
        await loadTicketsFromSupabase(); // Recargar para obtener nuevos IDs y confirmar cambios
    } catch (error) {
        console.error('Error al guardar datos de la tabla:', error);
        alert('Error inesperado al guardar los datos.');
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
            alert('Error al eliminar jugada: ' + (res.error || 'Error desconocido'));
        }
    }
}


// Agregar jugador a la base de datos Supabase
async function addPlayerToDatabase() {
    const nameInput = document.getElementById('newPlayerName');
    const name = nameInput.value.trim();
    if (!name) {
        alert('Por favor ingresa un nombre');
        return;
    }
    // Verificar si el jugador ya existe en Supabase
    if (typeof JugadoresDB !== 'undefined' && JugadoresDB.buscarPorNombre) {
        const res = await JugadoresDB.buscarPorNombre(name);
        if (res.success && res.data) {
            alert('Este jugador ya existe en la base de datos');
            return;
        }
    }
    // Agregar a Supabase
    if (typeof JugadoresDB !== 'undefined' && JugadoresDB.crear) {
        const res = await JugadoresDB.crear(name);
        if (res.success) {
            nameInput.value = '';
            await updatePlayersList();
            alert('Jugador agregado exitosamente!');
        } else {
            alert('Error al agregar jugador: ' + (res.error || 'Error desconocido'));
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
                alert('Error al eliminar jugador: ' + (del.error || 'Error desconocido'));
            }
        } else {
            alert('No se encontró el jugador en la base de datos');
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
        nameInput.addEventListener('input', handlePlayerNameInput);
        nameInput.addEventListener('keydown', handlePlayerNameKeydown);
        nameInput.addEventListener('blur', handlePlayerNameBlur);
        // Cargar jugadores desde Supabase para autocompletado
        loadAllPlayersForAutocomplete();
    }

    async function loadAllPlayersForAutocomplete() {
        if (typeof JugadoresDB !== 'undefined' && JugadoresDB.obtenerTodos) {
            const res = await JugadoresDB.obtenerTodos();
            if (res.success && Array.isArray(res.data)) {
                allPlayersSupabase = res.data.map(p => p.nombre);
            }
        }
    }
}

// Manejar input del campo de nombre
function handlePlayerNameInput(e) {
    const query = e.target.value.toLowerCase().trim();
    const autocompleteList = document.getElementById('autocompleteList');
    
    if (query.length === 0) {
        hideAutocomplete();
        return;
    }
    
    // Filtrar jugadores que coincidan desde Supabase
    filteredPlayers = allPlayersSupabase.filter(player => 
        player.toLowerCase().includes(query)
    );
    if (filteredPlayers.length > 0) {
        showAutocomplete(filteredPlayers, query);
    } else {
        hideAutocomplete();
    }
}

// Mostrar lista de autocompletado
function showAutocomplete(players, query) {
    const autocompleteList = document.getElementById('autocompleteList');
    autocompleteList.innerHTML = '';
    
    players.forEach((player, index) => {
        const item = document.createElement('div');
        item.className = 'p-2 hover:bg-blue-100 cursor-pointer border-b border-gray-200';
        item.innerHTML = highlightMatch(player, query);
        item.addEventListener('click', () => selectAutocompleteItem(item, player));
        autocompleteList.appendChild(item);
    });
    
    autocompleteList.classList.remove('hidden');
    currentAutocompleteIndex = -1;
}

// Ocultar lista de autocompletado
function hideAutocomplete() {
    const autocompleteList = document.getElementById('autocompleteList');
    autocompleteList.classList.add('hidden');
    autocompleteList.innerHTML = '';
    currentAutocompleteIndex = -1;
}

// Seleccionar item del autocompletado
function selectAutocompleteItem(item, playerName) {
    document.getElementById('playerName').value = playerName;
    hideAutocomplete();
}

// Resaltar coincidencias en el texto
function highlightMatch(text, query) {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<strong class="text-blue-600">$1</strong>');
}

// Manejar teclas en el campo de nombre
function handlePlayerNameKeydown(e) {
    const autocompleteList = document.getElementById('autocompleteList');
    const items = autocompleteList.querySelectorAll('div');
    
    if (autocompleteList.classList.contains('hidden') || items.length === 0) {
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
                selectAutocompleteItem(items[currentAutocompleteIndex], selectedPlayer);
            }
            break;
        case 'Escape':
            hideAutocomplete();
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

// Manejar blur del campo de nombre
function handlePlayerNameBlur(e) {
    // Delay para permitir clicks en la lista
    setTimeout(() => {
        hideAutocomplete();
    }, 200);
}

// Agregar jugador desde el formulario
async function addPlayerFromForm() {
    const name = document.getElementById('playerName').value.trim();
    const numbers = Array.from({ length: 6 }, (_, i) => document.getElementById(`number${i + 1}`).value.trim());
    const gratis = document.getElementById('gratis').value;
    
    // Validar que todos los campos estén llenos
    if (!name) return alert('Por favor ingresa el nombre del jugador');
    
    // Validar números
    const validNumbers = ['0', '00', ...Array.from({ length: 36 }, (_, i) => (i + 1).toString())];
    for (let i = 0; i < numbers.length; i++) {
        if (!numbers[i]) return alert(`Por favor ingresa el número ${i + 1}`);
        if (!validNumbers.includes(numbers[i])) return alert(`El número ${numbers[i]} no es válido.`);
    }
    
    // Validar números únicos
    if (new Set(numbers).size !== numbers.length) return alert('No puedes repetir números.');
    
    // Guardar jugada en Supabase
    if (typeof JugadasPollaDB !== 'undefined' && JugadasPollaDB.crear) {
        const jugadaData = {
            nombre_jugador: name,
            nro_1: numbers[0], nro_2: numbers[1], nro_3: numbers[2],
            nro_4: numbers[3], nro_5: numbers[4], nro_6: numbers[5],
            gratis: gratis === 'SÍ'
        };

        const resJugada = await JugadasPollaDB.crear([jugadaData]);

        if (resJugada.success) {
            if (typeof JugadoresDB !== 'undefined' && !allPlayersSupabase.includes(name)) {
                await JugadoresDB.crear(name);
                loadAllPlayersForAutocomplete();
            }
            await loadTicketsFromSupabase();
            updateCalculatedStats();
            closeAddPlayerModal();
            alert('Jugada agregada exitosamente!');
        } else {
            alert('Error al guardar jugada: ' + (resJugada.error || 'Error desconocido'));
        }
    }
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
