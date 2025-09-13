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
});

// Función de inicialización
function initializeGame() {
    console.log('Polla El Fenix inicializada');
    
    // Inicializar contadores
    playsCount = 0;
    winnersCount = 0;
    prizesToDistribute = 0;
    prizeAmount = 0;
    
    // Generar filas iniciales de la tabla
    generateInitialTableRows();
    
    // Cargar datos guardados desde localStorage
    loadTicketsData();
    loadGameStats();
    loadPlayersDatabase();
    
    // Marcar día actual
    highlightCurrentDay();
}

// Función para generar filas iniciales de la tabla
function generateInitialTableRows() {
    const tableBody = document.getElementById('playersTableBody');
    tableBody.innerHTML = ''; // Limpiar tabla existente
    
    // Generar 500 filas iniciales
    for (let i = 1; i <= 500; i++) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${i}</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            
        `;
        
        // Configurar eventos para la fila
        const cells = row.querySelectorAll('td');
        cells.forEach(cell => {
            if (!cell.classList.contains('number-cell')) {
                cell.addEventListener('click', function() {
                    makeCellEditable(this);
                });
            }
        });
        
        tableBody.appendChild(row);
    }
    
    console.log('500 filas generadas inicialmente');
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
    
    // Event listeners para agregar jugadores
    setupPlayerTableEvents();
    
    // Event listeners para los días de la semana
    const dayItems = document.querySelectorAll('.day-item');
    dayItems.forEach(day => {
        day.addEventListener('click', function() {
            selectDay(this);
        });
    });
    
    // Event listeners para las celdas editables de días
    setupDayValueCells();
}

// Configurar event listeners para las celdas de valores de días
function setupDayValueCells() {
    const dayValueCells = document.querySelectorAll('.day-value-cell');
    dayValueCells.forEach(cell => {
        cell.addEventListener('input', function() {
            // Validar que solo se ingresen números
            const value = this.textContent.trim();
            if (value && !/^\d+$/.test(value)) {
                this.textContent = '';
            }
            updateTotalPot();
        });
        
        cell.addEventListener('blur', function() {
            // Mantener vacío si no hay contenido válido
            const value = this.textContent.trim();
            if (value && !/^\d+$/.test(value)) {
                this.textContent = '';
            }
            updateTotalPot();
        });
        
        cell.addEventListener('keypress', function(e) {
            // Solo permitir números y Enter
            if (e.key === 'Enter') {
                this.blur();
            } else if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter'].includes(e.key)) {
                e.preventDefault();
            }
        });
        
        cell.addEventListener('click', function() {
            // Seleccionar todo el contenido al hacer clic
            if (this.textContent.trim()) {
                const range = document.createRange();
                range.selectNodeContents(this);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }
        });
    });
}

// Función para actualizar el total del pote
function updateTotalPot() {
    const dayValueCells = document.querySelectorAll('.day-value-cell');
    let total = 0;
    
    dayValueCells.forEach(cell => {
        const value = parseInt(cell.textContent.trim()) || 0;
        total += value;
    });
    
    document.getElementById('totalPotValue').textContent = total;
    
    // Guardar estadísticas automáticamente
    saveGameStats();
}

// Función para resetear toda la app
function resetAll() {
    // Reiniciar números seleccionados
    clearSelections();
    winningNumbers.clear();

    // Limpiar marcador de resultados
    const resultsSection = document.querySelector('.results-section');
    if (resultsSection) {
        resultsSection.innerHTML = '<div class="results-title">RESULTADOS</div>';
    }

    // Limpiar tabla de jugadores (mantener numeración y filas)
    const tableBody = document.getElementById('playersTableBody');
    const rows = tableBody.querySelectorAll('tr');
    rows.forEach((row, idx) => {
        const cells = row.querySelectorAll('td');
        // cells[0] = ## (se mantiene)
        for (let i = 1; i < cells.length; i++) {
            cells[i].textContent = '';
            cells[i].style.backgroundColor = '';
            cells[i].style.color = '';
            cells[i].style.fontWeight = '';
        }
        row.style.backgroundColor = '';
        row.style.border = '';
    });

    // Reiniciar estructuras en memoria
    players = [];
    playsCount = 0;
    winnersCount = 0;
    prizesToDistribute = 0;

    updateDisplay();

    // Actualizar estadísticas calculadas
    updateCalculatedStats();

    // Limpiar valores de días
    document.querySelectorAll('.day-value-cell').forEach(cell => {
        cell.textContent = '';
    });
    updateTotalPot();
    
    // Limpiar datos guardados en localStorage
    clearAllSavedData();
}

// Función para seleccionar un número ganador
function selectNumber(cell) {
    const number = cell.textContent;
    
    // Alternar selección
    if (cell.classList.contains('selected')) {
        cell.classList.remove('selected');
        cell.style.backgroundColor = '';
        cell.style.color = '';
        winningNumbers.delete(number);
    } else {
        cell.classList.add('selected');
        cell.style.backgroundColor = '#4CAF50';
        cell.style.color = 'white';
        winningNumbers.add(number);
    }
    
    console.log(`Número ${number} seleccionado como ganador`);
    updatePlayersTable(); // Actualizar tabla en tiempo real
    
    // Guardar estadísticas automáticamente
    saveGameStats();
}

// Función para seleccionar un día
function selectDay(dayElement) {
    // Remover selección anterior
    document.querySelectorAll('.day-item').forEach(day => {
        day.classList.remove('selected-day');
    });
    
    // Seleccionar día actual
    dayElement.classList.add('selected-day');
    dayElement.style.backgroundColor = '#ff6b35';
    dayElement.style.color = 'white';
    
    console.log(`Día seleccionado: ${dayElement.textContent}`);
}

// Función para resaltar el día actual
function highlightCurrentDay() {
    const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    const today = new Date().getDay();
    const currentDay = days[today];
    
    const dayElements = document.querySelectorAll('.day-item');
    dayElements.forEach(day => {
        if (day.textContent === currentDay) {
            day.classList.add('current-day');
            day.style.backgroundColor = '#ff6b35';
            day.style.color = 'white';
        }
    });
}

// Función para actualizar el contador de jugadas
function updatePlaysCount() {
    const selectedNumbers = document.querySelectorAll('.number-cell.selected');
    playsCount = selectedNumbers.length;
    document.getElementById('playsCount').textContent = playsCount;
    
    // Actualizar estadísticas
    updateStatistics();
}

// Función para actualizar estadísticas
function updateStatistics() {
    // Calcular premios basado en jugadas
    prizesToDistribute = playsCount * 30; // 30 BS por jugada
    prizeAmount = prizesToDistribute; // Ajuste según lógica del juego
    
    document.getElementById('prizesToDistribute').textContent = prizesToDistribute;
    document.getElementById('prizeAmount').textContent = prizeAmount;
}

// Configurar eventos de la tabla de jugadores
function setupPlayerTableEvents() {
    const tableBody = document.getElementById('playersTableBody');
    
    // Hacer las celdas editables
    const editableCells = tableBody.querySelectorAll('td');
    editableCells.forEach(cell => {
        if (!cell.classList.contains('number-cell')) {
            cell.addEventListener('click', function() {
                makeCellEditable(this);
            });
        }
    });
}

// Función para hacer una celda editable
function makeCellEditable(cell) {
    // Evitar múltiples ediciones simultáneas
    if (cell.querySelector('input')) {
        return;
    }
    
    const currentValue = cell.textContent;
    const cellIndex = cell.cellIndex;
    
    // Validación especial para celdas de números (columnas N°1 a N°6)
    const isNumberCell = cellIndex >= 2 && cellIndex <= 7; // Columnas N°1 a N°6
    const isGratisCell = cellIndex === 9; // Columna GRATIS
    
    if (isGratisCell) {
        // Crear selector SÍ/NO para la columna GRATIS
        createGratisSelector(cell);
        return;
    }
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentValue;
    input.style.width = '100%';
    input.style.height = '100%';
    input.style.border = 'none';
    input.style.outline = 'none';
    input.style.textAlign = 'center';
    input.style.fontSize = 'inherit';
    input.style.fontFamily = 'inherit';
    input.style.backgroundColor = 'transparent';
    input.style.padding = '0';
    input.style.margin = '0';
    
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
            if (['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
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
                if (validateUniqueNumbers(cell.parentElement, cell)) {
                    updatePlayerData(cell);
                }
            } else {
                input.value = currentValue; // Restaurar valor anterior si es inválido
                cell.textContent = currentValue;
            }
        } else {
            cell.textContent = input.value;
            updatePlayerData(cell);
        }
    });
    
    // Manejar tecla Enter
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur(); // Esto activará el evento blur
        }
    });
    
    // Manejar tecla Escape para cancelar
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            input.value = currentValue;
            input.blur();
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
        input.style.backgroundColor = '';
        return true;
    } else {
        input.style.backgroundColor = '#ffebee';
        return false;
    }
}

// Función para validar números repetidos en la misma fila
function validateUniqueNumbers(row, currentCell) {
    const cells = row.querySelectorAll('td');
    const currentValue = currentCell.textContent.trim();
    const currentIndex = currentCell.cellIndex;
    
    // Solo validar si hay un valor
    if (!currentValue) return true;
    
    // Verificar si el número ya existe en otras celdas de números (N°1 a N°6)
    for (let i = 2; i <= 7; i++) {
        if (i !== currentIndex) {
            const otherValue = cells[i].textContent.trim();
            if (otherValue === currentValue) {
                // Número repetido encontrado
                currentCell.style.backgroundColor = '#ffcdd2';
                currentCell.style.border = '2px solid #f44336';
                currentCell.textContent = '';
                alert(`Error: El número ${currentValue} ya está en uso en esta fila. No se pueden repetir números.`);
                return false;
            }
        }
    }
    
    // Si no hay repetición, limpiar estilos de error
    currentCell.style.backgroundColor = '';
    currentCell.style.border = '';
    return true;
}

// Función para crear selector SÍ/NO en la columna GRATIS
function createGratisSelector(cell) {
    const currentValue = cell.textContent.trim();
    
    // Crear contenedor del selector
    const selectorContainer = document.createElement('div');
    selectorContainer.style.display = 'flex';
    selectorContainer.style.gap = '5px';
    selectorContainer.style.justifyContent = 'center';
    selectorContainer.style.alignItems = 'center';
    selectorContainer.style.padding = '5px';
    
    // Crear botón SÍ
    const siButton = document.createElement('button');
    siButton.textContent = 'SÍ';
    siButton.style.padding = '5px 10px';
    siButton.style.border = '1px solid #4CAF50';
    siButton.style.borderRadius = '3px';
    siButton.style.cursor = 'pointer';
    siButton.style.fontSize = '12px';
    siButton.style.fontWeight = 'bold';
    
    if (currentValue === 'SÍ') {
        siButton.style.backgroundColor = '#4CAF50';
        siButton.style.color = 'white';
    } else {
        siButton.style.backgroundColor = 'white';
        siButton.style.color = '#4CAF50';
    }
    
    // Crear botón NO
    const noButton = document.createElement('button');
    noButton.textContent = 'NO';
    noButton.style.padding = '5px 10px';
    noButton.style.border = '1px solid #f44336';
    noButton.style.borderRadius = '3px';
    noButton.style.cursor = 'pointer';
    noButton.style.fontSize = '12px';
    noButton.style.fontWeight = 'bold';
    
    if (currentValue === 'NO') {
        noButton.style.backgroundColor = '#f44336';
        noButton.style.color = 'white';
    } else {
        noButton.style.backgroundColor = 'white';
        noButton.style.color = '#f44336';
    }
    
    // Event listeners para los botones
    siButton.addEventListener('click', function() {
        cell.textContent = 'SÍ';
        cell.style.backgroundColor = '#4CAF50';
        cell.style.color = 'white';
        updatePlayerData(cell);
    });
    
    noButton.addEventListener('click', function() {
        cell.textContent = 'NO';
        cell.style.backgroundColor = '';
        cell.style.color = '';
        updatePlayerData(cell);
    });
    
    // Agregar botones al contenedor
    selectorContainer.appendChild(siButton);
    selectorContainer.appendChild(noButton);
    
    // Reemplazar contenido de la celda
    cell.innerHTML = '';
    cell.appendChild(selectorContainer);
}

// Función para actualizar datos del jugador
function updatePlayerData(cell) {
    const row = cell.parentElement;
    const cells = row.querySelectorAll('td');
    const playerId = cells[0].textContent;
    const name = cells[1].textContent.trim(); // Ajustado sin columna Tt
    
    // Obtener los 6 números del jugador (columnas N°1 a N°6)
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
    saveTicketsData();
    saveGameStats();
}

// Función para actualizar contador de jugadas
function updatePlaysCounter() {
    const completePlayers = players.filter(p => p.isComplete);
    playsCount = completePlayers.length;
    document.getElementById('playsCount').textContent = playsCount;
    
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
    
    // Debug: verificar cálculos
    console.log(`Cálculos: TOTAL=${total}, -20%=${menos20Porciento}, Ganadores=${cantidadGanadores}, Premios=${premiosARepartir}`);
    
    // Actualizar displays
    updateStatDisplay('total', total);
    updateStatDisplay('menos20', menos20Porciento);
    updateStatDisplay('gratis', gratisCount);
    updateStatDisplay('premios', premiosARepartir);
}

// Función para contar ganadores (jugadores con 6 aciertos)
function countWinners() {
    const tableBody = document.getElementById('playersTableBody');
    const rows = tableBody.querySelectorAll('tr');
    let winnersCount = 0;
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length > 8) {
            const aciertosCell = cells[8]; // Columna # ACIERTOS
            
            if (aciertosCell && aciertosCell.textContent.trim() === '6') {
                winnersCount++;
            }
        }
    });
    
    return winnersCount;
}

// Función para contar jugadores GRATIS
function countGratisPlayers() {
    const tableBody = document.getElementById('playersTableBody');
    const rows = tableBody.querySelectorAll('tr');
    let gratisCount = 0;
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length > 9) {
            const gratisCell = cells[9]; // Columna GRATIS
            
            if (gratisCell && gratisCell.textContent.trim().toUpperCase() === 'SÍ') {
                gratisCount++;
            }
        }
    });
    
    return gratisCount;
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
        'pote': document.getElementById('poteValue')
    };
    
    if (elements[statType]) {
        elements[statType].textContent = value;
    }
}

// Función para actualizar la tabla de jugadores en tiempo real
function updatePlayersTable() {
    const tableBody = document.getElementById('playersTableBody');
    const rows = tableBody.querySelectorAll('tr');
    
    // Calcular aciertos para cada jugador
    players.forEach(player => {
        player.hits = 0;
        player.numbers.forEach(number => {
            if (winningNumbers.has(number)) {
                player.hits++;
            }
        });
    });
    
    // Ordenar jugadores por número de aciertos (descendente)
    players.sort((a, b) => b.hits - a.hits);
    
    // Actualizar filas existentes
    rows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        const playerId = cells[0].textContent;
        const player = players.find(p => p.id === playerId);
        
        if (player) {
            // Actualizar columna de aciertos (índice 8 después de N°1 a N°6)
            cells[8].textContent = player.hits;
            
            // Marcar números ganadores en verde (columnas N°1 a N°6)
            for (let i = 2; i <= 7; i++) {
                const numberCell = cells[i];
                const number = numberCell.textContent.trim();
                
                if (number && winningNumbers.has(number)) {
                    numberCell.style.backgroundColor = '#4CAF50';
                    numberCell.style.color = 'white';
                    numberCell.style.fontWeight = 'bold';
                } else {
                    numberCell.style.backgroundColor = '';
                    numberCell.style.color = '';
                    numberCell.style.fontWeight = '';
                }
            }
            
            // Agregar "G" en la primera columna (##) si es ganador
            const ticketNumberCell = cells[0];
            if (player.hits === 6) {
                if (!ticketNumberCell.textContent.startsWith('G')) {
                    ticketNumberCell.textContent = 'G' + ticketNumberCell.textContent;
                }
            } else {
                // Remover "G" si no es ganador
                if (ticketNumberCell.textContent.startsWith('G')) {
                    ticketNumberCell.textContent = ticketNumberCell.textContent.substring(1);
                }
            }
            
            // Actualizar columna GRATIS y aplicar colores según aciertos
            const gratisCell = cells[9];
            
            // Aplicar colores según el número de aciertos
            if (player.hits === 6) {
                // 6 aciertos - Verde oscuro (GANADOR)
                // NO cambiar el valor de GRATIS, solo aplicar estilos
                gratisCell.style.backgroundColor = '#2e7d32';
                gratisCell.style.color = 'white';
                row.style.border = '2px solid #2e7d32';
                cells[0].style.backgroundColor = '#c8e6c9'; // Columna ##
                cells[1].style.backgroundColor = '#c8e6c9'; // Columna NOMBRE
                cells[8].style.backgroundColor = '#c8e6c9'; // Columna # ACIERTOS
            } else if (player.hits === 5) {
                // 5 aciertos - Azul
                // NO cambiar el valor de GRATIS, solo aplicar estilos
                gratisCell.style.backgroundColor = '#1976d2';
                gratisCell.style.color = 'white';
                row.style.border = '2px solid #1976d2';
                cells[0].style.backgroundColor = '#e3f2fd'; // Columna ##
                cells[1].style.backgroundColor = '#e3f2fd'; // Columna NOMBRE
                cells[8].style.backgroundColor = '#e3f2fd'; // Columna # ACIERTOS
            } else if (player.hits === 4) {
                // 4 aciertos - Naranja
                // NO cambiar el valor de GRATIS, solo aplicar estilos
                gratisCell.style.backgroundColor = '#f57c00';
                gratisCell.style.color = 'white';
                row.style.border = '2px solid #f57c00';
                cells[0].style.backgroundColor = '#fff3e0'; // Columna ##
                cells[1].style.backgroundColor = '#fff3e0'; // Columna NOMBRE
                cells[8].style.backgroundColor = '#fff3e0'; // Columna # ACIERTOS
            } else if (player.hits === 3) {
                // 3 aciertos - Púrpura
                // NO cambiar el valor de GRATIS, solo aplicar estilos
                gratisCell.style.backgroundColor = '#7b1fa2';
                gratisCell.style.color = 'white';
                row.style.border = '2px solid #7b1fa2';
                cells[0].style.backgroundColor = '#f3e5f5'; // Columna ##
                cells[1].style.backgroundColor = '#f3e5f5'; // Columna NOMBRE
                cells[8].style.backgroundColor = '#f3e5f5'; // Columna # ACIERTOS
            } else if (player.hits === 2) {
                // 2 aciertos - Rosa
                // NO cambiar el valor de GRATIS, solo aplicar estilos
                gratisCell.style.backgroundColor = '#c2185b';
                gratisCell.style.color = 'white';
                row.style.border = '2px solid #c2185b';
                cells[0].style.backgroundColor = '#fce4ec'; // Columna ##
                cells[1].style.backgroundColor = '#fce4ec'; // Columna NOMBRE
                cells[8].style.backgroundColor = '#fce4ec'; // Columna # ACIERTOS
            } else if (player.hits === 1) {
                // 1 acierto - Amarillo
                // NO cambiar el valor de GRATIS, solo aplicar estilos
                gratisCell.style.backgroundColor = '#f9a825';
                gratisCell.style.color = 'white';
                row.style.border = '2px solid #f9a825';
                cells[0].style.backgroundColor = '#fffde7'; // Columna ##
                cells[1].style.backgroundColor = '#fffde7'; // Columna NOMBRE
                cells[8].style.backgroundColor = '#fffde7'; // Columna # ACIERTOS
            } else {
                // 0 aciertos - Sin color (blanco)
                // NO cambiar el valor de GRATIS, solo aplicar estilos
                gratisCell.style.backgroundColor = '';
                gratisCell.style.color = '';
                row.style.border = '';
                cells[0].style.backgroundColor = ''; // Columna ##
                cells[1].style.backgroundColor = ''; // Columna NOMBRE
                cells[8].style.backgroundColor = ''; // Columna # ACIERTOS
            }
        }
    });
    
    // Reordenar filas según aciertos
    reorderTableRows();
    
    // Actualizar estadísticas
    updateStatistics();
}

// Función para reordenar las filas de la tabla
function reorderTableRows() {
    const tableBody = document.getElementById('playersTableBody');
    const rows = Array.from(tableBody.querySelectorAll('tr'));
    
    // Crear array de filas con sus datos de jugador
    const rowsWithData = rows.map(row => {
        const cells = row.querySelectorAll('td');
        const playerId = cells[0].textContent;
        const player = players.find(p => p.id === playerId);
        return {
            row: row,
            player: player,
            hits: player ? player.hits : 0
        };
    });
    
    // Ordenar por aciertos (descendente) - GANADORES (6 aciertos) SIEMPRE ARRIBA
    rowsWithData.sort((a, b) => {
        // Si ambos son ganadores (6 aciertos), mantener orden original
        if (a.hits === 6 && b.hits === 6) {
            return 0;
        }
        // Si solo 'a' es ganador, va primero
        if (a.hits === 6 && b.hits !== 6) {
            return -1;
        }
        // Si solo 'b' es ganador, va primero
        if (b.hits === 6 && a.hits !== 6) {
            return 1;
        }
        // Para el resto, ordenar por aciertos descendente
        return b.hits - a.hits;
    });
    
    // Reorganizar filas en el DOM
    rowsWithData.forEach(item => {
        tableBody.appendChild(item.row);
    });
    
    // Actualizar estadísticas calculadas después de actualizar aciertos
    updateCalculatedStats();
}

// Función para actualizar estadísticas
function updateStatistics() {
    const totalWinners = players.filter(p => p.hits === 6).length;
    const totalPlayers = players.filter(p => p.name.trim() !== '').length;
    
    winnersCount = totalWinners;
    prizesToDistribute = totalPlayers * 30; // 30 BS por jugada
    prizeAmount = prizesToDistribute - 143;
    
    document.getElementById('winnersCount').textContent = winnersCount;
    document.getElementById('prizesToDistribute').textContent = prizesToDistribute;
    document.getElementById('prizeAmount').textContent = prizeAmount;
    
    // Actualizar total del pote
    document.getElementById('totalPotValue').textContent = prizesToDistribute;
}

// Función para agregar más filas si se necesitan
function addMoreRows() {
    const tableBody = document.getElementById('playersTableBody');
    const currentRows = tableBody.querySelectorAll('tr').length;
    const newStartNumber = currentRows + 1;
    
    // Agregar 100 filas más
    for (let i = newStartNumber; i < newStartNumber + 100; i++) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${i}</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
        `;
        
        // Configurar eventos para la fila
        const cells = row.querySelectorAll('td');
        cells.forEach(cell => {
            if (!cell.classList.contains('number-cell')) {
                cell.addEventListener('click', function() {
                    makeCellEditable(this);
                });
            }
        });
        
        tableBody.appendChild(row);
    }
    
    console.log(`100 filas adicionales agregadas (${newStartNumber} - ${newStartNumber + 99})`);
}

// Función para limpiar selecciones
function clearSelections() {
    const selectedNumbers = document.querySelectorAll('.number-cell.selected');
    selectedNumbers.forEach(cell => {
        cell.classList.remove('selected');
        cell.style.backgroundColor = '';
        cell.style.color = '';
    });
    
    winningNumbers.clear();
    updatePlayersTable();
    console.log('Selecciones limpiadas');
}

// Función para simular sorteo automático
function simulateDraw() {
    const allNumbers = ['0', '00', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
                       '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
                       '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
                       '31', '32', '33', '34', '35', '36'];
    
    // Limpiar selecciones anteriores
    clearSelections();
    
    // Seleccionar 6 números ganadores aleatorios
    const newWinningNumbers = [];
    const availableNumbers = [...allNumbers];
    
    for (let i = 0; i < 6; i++) {
        const randomIndex = Math.floor(Math.random() * availableNumbers.length);
        const selectedNumber = availableNumbers[randomIndex];
        newWinningNumbers.push(selectedNumber);
        availableNumbers.splice(randomIndex, 1);
        
        // Marcar visualmente en el tablero
        const numberCells = document.querySelectorAll('.number-cell');
        numberCells.forEach(cell => {
            if (cell.textContent === selectedNumber) {
                cell.classList.add('selected');
                cell.style.backgroundColor = '#4CAF50';
                cell.style.color = 'white';
                winningNumbers.add(selectedNumber);
            }
        });
    }
    
    // Mostrar números ganadores
    const resultsSection = document.querySelector('.results-section');
    resultsSection.innerHTML = `
        <div style="text-align: center; color: #2c3e50;">
            <div style="font-weight: bold; margin-bottom: 10px;">NÚMEROS GANADORES</div>
            <div style="font-size: 14px;">${newWinningNumbers.join(' - ')}</div>
        </div>
    `;
    
    // Actualizar tabla de jugadores
    updatePlayersTable();
    
    console.log('Sorteo simulado - Números ganadores:', newWinningNumbers);
}

// Función para actualizar la pantalla
function updateDisplay() {
    document.getElementById('playsCount').textContent = playsCount;
    document.getElementById('winnersCount').textContent = winnersCount;
    document.getElementById('prizesToDistribute').textContent = prizesToDistribute;
    document.getElementById('prizeAmount').textContent = prizeAmount;
}

// Funciones de utilidad
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-VE', {
        style: 'currency',
        currency: 'VES'
    }).format(amount);
}

function getCurrentDateTime() {
    const now = new Date();
    return now.toLocaleString('es-VE');
}

// Funciones del modal para agregar jugador
function openAddPlayerModal() {
    const modal = document.getElementById('addPlayerModal');
    modal.style.display = 'block';
    
    // Cargar base de datos de jugadores
    loadPlayersDatabase();
    
    // Actualizar autocompletado
    updatePlayerNameField();
    
    // Limpiar formulario
    document.getElementById('addPlayerForm').reset();
    
    // Enfocar en el primer campo
    document.getElementById('playerName').focus();
}

function closeAddPlayerModal() {
    const modal = document.getElementById('addPlayerModal');
    modal.style.display = 'none';
}

// Función para agregar jugador desde el formulario
function addPlayerFromForm() {
    const name = document.getElementById('playerName').value.trim();
    const numbers = [
        document.getElementById('number1').value.trim(),
        document.getElementById('number2').value.trim(),
        document.getElementById('number3').value.trim(),
        document.getElementById('number4').value.trim(),
        document.getElementById('number5').value.trim(),
        document.getElementById('number6').value.trim()
    ];
    const gratis = document.getElementById('gratis').value;
    
    // Validar que todos los campos estén llenos
    if (!name) {
        alert('Por favor ingresa el nombre del jugador');
        return;
    }
    
    // Validar números
    const validNumbers = ['0', '00', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
                         '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
                         '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
                         '31', '32', '33', '34', '35', '36'];
    
    for (let i = 0; i < numbers.length; i++) {
        if (!numbers[i]) {
            alert(`Por favor ingresa el número ${i + 1}`);
            return;
        }
        if (!validNumbers.includes(numbers[i])) {
            alert(`El número ${numbers[i]} no es válido. Solo se permiten números del 0, 00, 1 al 36`);
            return;
        }
    }
    
    // Validar números únicos
    const uniqueNumbers = [...new Set(numbers)];
    if (uniqueNumbers.length !== numbers.length) {
        alert('No puedes repetir números. Todos los números deben ser diferentes.');
        return;
    }
    
    // Encontrar la primera fila vacía
    const tableBody = document.getElementById('playersTableBody');
    const rows = tableBody.querySelectorAll('tr');
    let emptyRow = null;
    
    for (let row of rows) {
        const cells = row.querySelectorAll('td');
        const nameCell = cells[1].textContent.trim();
        if (!nameCell) {
            emptyRow = row;
            break;
        }
    }
    
    if (!emptyRow) {
        alert('No hay filas disponibles. Agrega más filas primero.');
        return;
    }
    
    // Llenar la fila con los datos del formulario
    const cells = emptyRow.querySelectorAll('td');
    cells[1].textContent = name; // NOMBRE
    
    for (let i = 0; i < 6; i++) {
        cells[i + 2].textContent = numbers[i]; // N°1 a N°6
    }
    
    cells[9].textContent = gratis; // GRATIS
    
    // Aplicar estilos si es gratis
    if (gratis === 'SÍ') {
        cells[9].style.backgroundColor = '#4CAF50';
        cells[9].style.color = 'white';
    }
    
    // Agregar nombre a la base de datos si no existe
    if (!playersDatabase.includes(name)) {
        playersDatabase.push(name);
        savePlayersDatabase();
    }
    
    // Actualizar datos del jugador
    updatePlayerData(cells[1]);
    
    // Actualizar estadísticas calculadas
    updateCalculatedStats();
    
    // Cerrar modal
    closeAddPlayerModal();
    
    alert('Jugada agregada exitosamente!');
}

// Configurar el formulario
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('addPlayerForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            addPlayerFromForm();
        });
    }
    
    // Cerrar modal al hacer clic fuera
    window.addEventListener('click', function(e) {
        const modal = document.getElementById('addPlayerModal');
        if (e.target === modal) {
            closeAddPlayerModal();
        }
    });
});

// ===== FUNCIONES PARA GESTIÓN DE BASE DE DATOS DE JUGADORES =====

// Cargar base de datos de jugadores desde localStorage
function loadPlayersDatabase() {
    const saved = localStorage.getItem('playersDatabase');
    if (saved) {
        playersDatabase = JSON.parse(saved);
    }
}

// Guardar base de datos de jugadores en localStorage
function savePlayersDatabase() {
    localStorage.setItem('playersDatabase', JSON.stringify(playersDatabase));
}

// ===== FUNCIONES PARA PERSISTENCIA DE DATOS DE TICKETS =====

// Guardar todos los datos de tickets en localStorage
function saveTicketsData() {
    const tableBody = document.getElementById('playersTableBody');
    const rows = tableBody.querySelectorAll('tr');
    const ticketsData = [];
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const ticketData = {
            id: cells[0].textContent,
            name: cells[1].textContent.trim(),
            numbers: [
                cells[2].textContent.trim(),
                cells[3].textContent.trim(),
                cells[4].textContent.trim(),
                cells[5].textContent.trim(),
                cells[6].textContent.trim(),
                cells[7].textContent.trim()
            ],
            hits: cells[8].textContent.trim(),
            gratis: cells[9].textContent.trim(),
            // Guardar estilos de la fila
            rowStyles: {
                backgroundColor: row.style.backgroundColor,
                border: row.style.border
            },
            // Guardar estilos de las celdas
            cellStyles: Array.from(cells).map(cell => ({
                backgroundColor: cell.style.backgroundColor,
                color: cell.style.color,
                fontWeight: cell.style.fontWeight,
                border: cell.style.border
            }))
        };
        ticketsData.push(ticketData);
    });
    
    localStorage.setItem('ticketsData', JSON.stringify(ticketsData));
    console.log('Datos de tickets guardados en localStorage');
}

// Cargar todos los datos de tickets desde localStorage
function loadTicketsData() {
    const saved = localStorage.getItem('ticketsData');
    if (!saved) return;
    
    try {
        const ticketsData = JSON.parse(saved);
        const tableBody = document.getElementById('playersTableBody');
        const rows = tableBody.querySelectorAll('tr');
        
        ticketsData.forEach((ticketData, index) => {
            if (index < rows.length) {
                const row = rows[index];
                const cells = row.querySelectorAll('td');
                
                // Restaurar datos básicos
                cells[0].textContent = ticketData.id;
                cells[1].textContent = ticketData.name;
                
                // Restaurar números
                for (let i = 0; i < 6; i++) {
                    cells[i + 2].textContent = ticketData.numbers[i];
                }
                
                cells[8].textContent = ticketData.hits;
                cells[9].textContent = ticketData.gratis;
                
                // Restaurar estilos de la fila
                if (ticketData.rowStyles) {
                    row.style.backgroundColor = ticketData.rowStyles.backgroundColor;
                    row.style.border = ticketData.rowStyles.border;
                }
                
                // Restaurar estilos de las celdas
                if (ticketData.cellStyles) {
                    ticketData.cellStyles.forEach((cellStyle, cellIndex) => {
                        if (cells[cellIndex]) {
                            cells[cellIndex].style.backgroundColor = cellStyle.backgroundColor;
                            cells[cellIndex].style.color = cellStyle.color;
                            cells[cellIndex].style.fontWeight = cellStyle.fontWeight;
                            cells[cellIndex].style.border = cellStyle.border;
                        }
                    });
                }
                
                // Actualizar datos del jugador si tiene información
                if (ticketData.name) {
                    updatePlayerData(cells[1]);
                }
            }
        });
        
        console.log('Datos de tickets cargados desde localStorage');
    } catch (error) {
        console.error('Error al cargar datos de tickets:', error);
    }
}

// Guardar estadísticas del marcador en localStorage
function saveGameStats() {
    const gameStats = {
        playsCount: playsCount,
        winnersCount: winnersCount,
        prizesToDistribute: prizesToDistribute,
        prizeAmount: prizeAmount,
        winningNumbers: Array.from(winningNumbers),
        // Guardar valores de días
        dayValues: {},
        totalPot: document.getElementById('totalPotValue').textContent
    };
    
    // Guardar valores de días
    const dayValueCells = document.querySelectorAll('.day-value-cell');
    dayValueCells.forEach((cell, index) => {
        const dayName = cell.getAttribute('data-day');
        if (dayName) {
            gameStats.dayValues[dayName] = cell.textContent.trim();
        }
    });
    
    localStorage.setItem('gameStats', JSON.stringify(gameStats));
    console.log('Estadísticas del juego guardadas en localStorage');
}

// Cargar estadísticas del marcador desde localStorage
function loadGameStats() {
    const saved = localStorage.getItem('gameStats');
    if (!saved) return;
    
    try {
        const gameStats = JSON.parse(saved);
        
        // Restaurar contadores
        playsCount = gameStats.playsCount || 0;
        winnersCount = gameStats.winnersCount || 0;
        prizesToDistribute = gameStats.prizesToDistribute || 0;
        prizeAmount = gameStats.prizeAmount || 0;
        
        // Restaurar números ganadores
        if (gameStats.winningNumbers) {
            winningNumbers.clear();
            gameStats.winningNumbers.forEach(number => {
                winningNumbers.add(number);
            });
            
            // Marcar visualmente los números ganadores
            const numberCells = document.querySelectorAll('.number-cell');
            numberCells.forEach(cell => {
                if (winningNumbers.has(cell.textContent)) {
                    cell.classList.add('selected');
                    cell.style.backgroundColor = '#4CAF50';
                    cell.style.color = 'white';
                }
            });
        }
        
        // Restaurar valores de días
        if (gameStats.dayValues) {
            const dayValueCells = document.querySelectorAll('.day-value-cell');
            dayValueCells.forEach(cell => {
                const dayName = cell.getAttribute('data-day');
                if (dayName && gameStats.dayValues[dayName]) {
                    cell.textContent = gameStats.dayValues[dayName];
                }
            });
        }
        
        // Restaurar total del pote
        if (gameStats.totalPot) {
            document.getElementById('totalPotValue').textContent = gameStats.totalPot;
        }
        
        // Actualizar displays
        updateDisplay();
        updateCalculatedStats();
        
        console.log('Estadísticas del juego cargadas desde localStorage');
    } catch (error) {
        console.error('Error al cargar estadísticas del juego:', error);
    }
}

// Función para limpiar todos los datos guardados
function clearAllSavedData() {
    localStorage.removeItem('ticketsData');
    localStorage.removeItem('gameStats');
    localStorage.removeItem('playersDatabase');
    console.log('Todos los datos guardados han sido eliminados');
}

// Función de debug para verificar el guardado
function debugSaveData() {
    console.log('=== DEBUG GUARDADO ===');
    console.log('Tickets guardados:', localStorage.getItem('ticketsData'));
    console.log('Stats guardadas:', localStorage.getItem('gameStats'));
    console.log('Players guardados:', localStorage.getItem('playersDatabase'));
    console.log('========================');
}

// Agregar jugador a la base de datos
function addPlayerToDatabase() {
    const nameInput = document.getElementById('newPlayerName');
    const name = nameInput.value.trim();
    
    if (!name) {
        alert('Por favor ingresa un nombre');
        return;
    }
    
    // Verificar si el jugador ya existe
    if (playersDatabase.includes(name)) {
        alert('Este jugador ya existe en la base de datos');
        return;
    }
    
    // Agregar a la base de datos
    playersDatabase.push(name);
    savePlayersDatabase();
    
    // Limpiar input
    nameInput.value = '';
    
    // Actualizar lista
    updatePlayersList();
    
    alert('Jugador agregado exitosamente!');
}

// Eliminar jugador de la base de datos
function removePlayerFromDatabase(playerName) {
    if (confirm(`¿Estás seguro de que quieres eliminar a ${playerName}?`)) {
        const index = playersDatabase.indexOf(playerName);
        if (index > -1) {
            playersDatabase.splice(index, 1);
            savePlayersDatabase();
            updatePlayersList();
        }
    }
}

// Actualizar lista de jugadores en el modal
function updatePlayersList() {
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = '';
    
    playersDatabase.forEach(playerName => {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        playerItem.innerHTML = `
            <span class="player-name">${playerName}</span>
            <button onclick="removePlayerFromDatabase('${playerName}')" class="delete-player-btn">ELIMINAR</button>
        `;
        playersList.appendChild(playerItem);
    });
}

// Abrir modal de gestión de jugadores
function openPlayerManagerModal() {
    loadPlayersDatabase();
    updatePlayersList();
    document.getElementById('playerManagerModal').style.display = 'block';
}

// Cerrar modal de gestión de jugadores
function closePlayerManagerModal() {
    document.getElementById('playerManagerModal').style.display = 'none';
}

// Variables para autocompletado
let currentAutocompleteIndex = -1;
let filteredPlayers = [];

// Actualizar el campo de nombre con autocompletado personalizado
function updatePlayerNameField() {
    const nameInput = document.getElementById('playerName');
    if (nameInput) {
        // Remover event listeners existentes
        nameInput.removeEventListener('input', handlePlayerNameInput);
        nameInput.removeEventListener('keydown', handlePlayerNameKeydown);
        nameInput.removeEventListener('blur', handlePlayerNameBlur);
        
        // Agregar nuevos event listeners
        nameInput.addEventListener('input', handlePlayerNameInput);
        nameInput.addEventListener('keydown', handlePlayerNameKeydown);
        nameInput.addEventListener('blur', handlePlayerNameBlur);
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
    
    // Filtrar jugadores que coincidan
    filteredPlayers = playersDatabase.filter(player => 
        player.toLowerCase().includes(query)
    );
    
    if (filteredPlayers.length > 0) {
        showAutocomplete(filteredPlayers, query);
    } else {
        hideAutocomplete();
    }
}

// Manejar teclas en el campo de nombre
function handlePlayerNameKeydown(e) {
    const autocompleteList = document.getElementById('autocompleteList');
    const items = autocompleteList.querySelectorAll('.autocomplete-item');
    
    if (!autocompleteList.classList.contains('show') || items.length === 0) {
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
                selectAutocompleteItem(items[currentAutocompleteIndex]);
            }
            break;
        case 'Escape':
            hideAutocomplete();
            break;
    }
}

// Manejar blur del campo de nombre
function handlePlayerNameBlur(e) {
    // Delay para permitir clicks en la lista
    setTimeout(() => {
        hideAutocomplete();
    }, 200);
}

// Mostrar lista de autocompletado
function showAutocomplete(players, query) {
    const autocompleteList = document.getElementById('autocompleteList');
    autocompleteList.innerHTML = '';
    
    players.forEach((player, index) => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.innerHTML = `
            <div class="player-icon">${player.charAt(0).toUpperCase()}</div>
            <div class="player-name">${highlightMatch(player, query)}</div>
            <div class="player-hint">Jugador registrado</div>
        `;
        
        item.addEventListener('click', () => selectAutocompleteItem(item));
        autocompleteList.appendChild(item);
    });
    
    autocompleteList.classList.add('show');
    currentAutocompleteIndex = -1;
}

// Ocultar lista de autocompletado
function hideAutocomplete() {
    const autocompleteList = document.getElementById('autocompleteList');
    autocompleteList.classList.remove('show');
    autocompleteList.innerHTML = '';
    currentAutocompleteIndex = -1;
}

// Actualizar selección visual
function updateAutocompleteSelection(items) {
    items.forEach((item, index) => {
        if (index === currentAutocompleteIndex) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// Seleccionar item del autocompletado
function selectAutocompleteItem(item) {
    const playerName = item.querySelector('.player-name').textContent;
    document.getElementById('playerName').value = playerName;
    hideAutocomplete();
}

// Resaltar coincidencias en el texto
function highlightMatch(text, query) {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<strong>$1</strong>');
}

// Exportar funciones para uso global
window.addMoreRows = addMoreRows;
window.clearSelections = clearSelections;
window.simulateDraw = simulateDraw;
window.updatePlayerStats = updatePlayerStats;
window.openAddPlayerModal = openAddPlayerModal;
window.closeAddPlayerModal = closeAddPlayerModal;
window.openPlayerManagerModal = openPlayerManagerModal;
window.closePlayerManagerModal = closePlayerManagerModal;
window.addPlayerToDatabase = addPlayerToDatabase;
window.removePlayerFromDatabase = removePlayerFromDatabase;
window.saveTicketsData = saveTicketsData;
window.loadTicketsData = loadTicketsData;
window.saveGameStats = saveGameStats;
window.loadGameStats = loadGameStats;
window.clearAllSavedData = clearAllSavedData;
window.debugSaveData = debugSaveData;
