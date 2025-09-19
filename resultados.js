// Variables globales para resultados
let resultsData = [];
let winningNumbers = [];
let currentGameType = 'polla'; // 'polla' o 'micro'

// Inicialización cuando se carga la página
document.addEventListener('DOMContentLoaded', async function() {
    // Inicializar Supabase
    if (typeof initializeSupabase === 'function') {
        if (!initializeSupabase()) {
            console.error("Fallo al inicializar Supabase. La página de resultados no funcionará correctamente.");
            document.body.innerHTML = '<div style="color: red; text-align: center; padding: 50px; font-size: 1.2rem;">Error al conectar con la base de datos. Por favor, vuelve a la página principal e inténtalo de nuevo.</div>';
            return;
        }
    } else {
        console.error("La función initializeSupabase no está definida. Asegúrate de que los scripts se cargan en el orden correcto.");
        return;
    }

    setupTabs();
    await loadAndDisplayData();
});

function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', async () => {
            // No hacer nada si el tab ya está activo
            if (tab.classList.contains('active')) return;

            // Cambiar estado visual
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Actualizar tipo de juego y recargar datos
            currentGameType = tab.dataset.game;
            await loadAndDisplayData();
        });
    });
}

async function loadAndDisplayData() {
    await loadDataFromSupabase();
    displayResults();
}

async function loadDataFromSupabase() {
    try {
        // Cargar números ganadores
        const winningNumbersResult = await ResultadosNumerosDB.obtenerUltimo();
        if (winningNumbersResult.success && winningNumbersResult.data && Array.isArray(winningNumbersResult.data.numeros_ganadores)) {
            winningNumbers = winningNumbersResult.data.numeros_ganadores.map(String); // Asegurar que sean strings para comparación
        }

        // Cargar datos de tickets/jugadores
        let ticketsResult;
        if (currentGameType === 'polla') {
            ticketsResult = await JugadasPollaDB.obtenerTodas();
        } else {
            ticketsResult = await JugadasMicroDB.obtenerTodas();
        }

        if (ticketsResult.success && Array.isArray(ticketsResult.data)) {
            const tickets = ticketsResult.data;
            
            resultsData = tickets
                .map(ticket => {
                    const playerName = ticket.nombre_jugador || 'Jugador Desconocido';
                    
                    let playerNumbers;
                    if (currentGameType === 'polla') {
                        playerNumbers = [
                            ticket.nro_1, ticket.nro_2, ticket.nro_3,
                            ticket.nro_4, ticket.nro_5, ticket.nro_6,
                        ].filter(n => n !== null && n !== undefined).map(String);
                    } else { // micro
                        playerNumbers = [
                            ticket.nro_1, ticket.nro_2, ticket.nro_3,
                        ].filter(n => n !== null && n !== undefined).map(String);
                    }
                    
                    // Calcular aciertos
                    let hits = 0;
                    playerNumbers.forEach(number => { if (winningNumbers.includes(number)) hits++; });

                    return {
                        id: ticket.id,
                        name: playerName,
                        numbers: playerNumbers,
                        hits: hits,
                        gratis: ticket.gratis,
                        prize: 0 // Se calculará después
                    };
                });

            // Encontrar el número máximo de aciertos
            const maxHits = resultsData.length > 0 ? Math.max(...resultsData.map(p => p.hits)) : 0;

            // Calcular premios
            const payingPlayers = resultsData.filter(player => !player.gratis);
            const winnersWithMaxHits = payingPlayers.filter(player => player.hits === maxHits);
            const totalPrize = payingPlayers.length * 30; // Asumiendo 30 BS por jugada para ambos
            const prizePool = totalPrize * 0.8;
            
            let prizeForMaxHits = 0;
            if (currentGameType === 'polla') {
                // Para polla, el premio principal se reparte si hay ganadores con 3 o más aciertos
                prizeForMaxHits = (maxHits >= 3 && winnersWithMaxHits.length > 0)
                    ? Math.floor(prizePool / winnersWithMaxHits.length)
                    : 0;
            } else { // micro
                // Para micro, el premio principal solo se reparte si hay ganadores con el máximo de 3 aciertos
                prizeForMaxHits = (maxHits === 3 && winnersWithMaxHits.length > 0)
                    ? Math.floor(prizePool / winnersWithMaxHits.length)
                    : 0;
            }

            // Asignar premios a cada jugador
            resultsData.forEach(player => {
                player.prize = calculatePrize(player.hits, player.gratis, maxHits, prizeForMaxHits, currentGameType);
            });

            // Ordenar por aciertos (descendente) y luego por nombre
            resultsData.sort((a, b) => b.hits - a.hits || a.name.localeCompare(b.name));
        }
    } catch (error) {
        console.error('Error al cargar datos de resultados desde Supabase:', error);
        resultsData = [];
        winningNumbers = [];
    }
}

// Calcular premio según aciertos
function calculatePrize(hits, isGratis, maxHits, prizeForMaxHits, gameType) {
    if (isGratis) return 0;

    // Si el jugador es uno de los ganadores principales
    if (hits === maxHits && prizeForMaxHits > 0) {
        return prizeForMaxHits;
    }
    
    // Premios fijos solo para el juego de polla (si no son el máximo)
    if (gameType === 'polla') {
        switch (hits) {
            case 5:
                return 50;
            case 4:
                return 20;
            case 3:
                return 10;
        }
    }
    
    // No hay premios fijos para 'micro' en esta implementación, o para otros casos de 'polla'
    return 0;
}

// Mostrar números ganadores
function displayWinningNumbers() {
    const container = document.getElementById('winningNumbersGrid');
    container.innerHTML = '';

    if (winningNumbers.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">No se han seleccionado números ganadores</p>';
        return;
    }

    winningNumbers.forEach(number => {
        const numberElement = document.createElement('div');
        numberElement.className = 'winning-number';
        numberElement.textContent = number;
        container.appendChild(numberElement);
    });
}

// Mostrar estadísticas resumen
function displaySummaryStats() {
    const maxHits = resultsData.length > 0 ? Math.max(...resultsData.map(p => p.hits)) : 0;
    const winnersWithMaxHits = resultsData.filter(player => player.hits === maxHits);
    const payingPlayers = resultsData.filter(player => !player.gratis);
    const payingWinners = winnersWithMaxHits.filter(player => !player.gratis);
    
    const totalPrize = payingPlayers.length * 30; // Asumiendo 30 BS por jugada para ambos
    const prizePool = totalPrize * 0.8;
    
    let prizePerWinner = 0;
    if (currentGameType === 'polla') {
        prizePerWinner = (maxHits >= 3 && payingWinners.length > 0) ? Math.floor(prizePool / payingWinners.length) : 0;
    } else { // micro
        prizePerWinner = (maxHits === 3 && payingWinners.length > 0) ? Math.floor(prizePool / payingWinners.length) : 0;
    }

    // Actualizar título principal
    document.querySelector('.results-title').textContent = currentGameType === 'polla' ? 'RESULTADOS POLLA EL FÉNIX' : 'RESULTADOS MICRO';
    
    document.getElementById('totalPlayersResult').textContent = resultsData.length;
    
    // Actualizar dinámicamente el label de ganadores
    const winnerLabel = document.querySelector('#totalWinnersResult + .stat-label');
    if (winnerLabel) {
        winnerLabel.textContent = `Ganadores (${maxHits} aciertos)`;
    }
    document.getElementById('totalWinnersResult').textContent = winnersWithMaxHits.length;
    document.getElementById('totalPrizeResult').textContent = `${totalPrize} BS`;
    document.getElementById('prizePerWinnerResult').textContent = prizePerWinner > 0 ? `${prizePerWinner} BS` : 'N/A';
}

// Mostrar tabla de resultados
function displayResultsTable() {
    const tableBody = document.getElementById('resultsTableBody');
    tableBody.innerHTML = '';

    if (resultsData.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" style="text-align: center; padding: 40px; color: #666;">No hay datos de jugadores disponibles</td>';
        tableBody.appendChild(row);
        return;
    }

    resultsData.forEach((player, index) => {
        const row = document.createElement('tr');
        
        // Aplicar clase CSS según aciertos
        let rowClass = '';
        const maxPossibleHits = currentGameType === 'polla' ? winningNumbers.length : 3;

        // Usar un switch solo si el jugador es un ganador principal o tiene aciertos significativos
        if (player.hits === maxPossibleHits && player.hits > 0) {
            rowClass = 'winner-row';
        } else {
            switch (player.hits) {
                case 5:
                    rowClass = 'five-hits-row';
                    break;
                case 4:
                    rowClass = 'four-hits-row';
                    break;
                case 3:
                    rowClass = 'three-hits-row';
                    break;
                case 2:
                    rowClass = 'two-hits-row';
                    break;
                case 1:
                    rowClass = 'one-hit-row';
                    break;
            }
        }
        
        if (rowClass) {
            row.className = rowClass;
        }

        // Crear celdas
        const positionCell = document.createElement('td');
        positionCell.className = 'position-cell';
        positionCell.textContent = index + 1;
        if (player.hits === maxPossibleHits && player.hits > 0) {
            positionCell.innerHTML = `🏆 ${index + 1}`;
        }

        const nameCell = document.createElement('td');
        nameCell.textContent = player.name;

        const numbersCell = document.createElement('td');
        numbersCell.innerHTML = player.numbers.map(number => {
            const isHit = winningNumbers.includes(number);
            return `<span class="${isHit ? 'hit-number' : 'miss-number'}">${number}</span>`;
        }).join(' ');

        const hitsCell = document.createElement('td');
        hitsCell.innerHTML = `<span class="hits-badge">${player.hits}</span>`;

        const gratisCell = document.createElement('td');
        if (player.gratis) {
            gratisCell.innerHTML = '<span class="gratis-badge">SÍ</span>';
        } else {
            gratisCell.textContent = 'NO';
        }

        const prizeCell = document.createElement('td');
        if (player.prize > 0) {
            prizeCell.innerHTML = `<strong>${player.prize} BS</strong>`;
            prizeCell.style.color = '#4CAF50';
            prizeCell.style.fontWeight = 'bold';
        } else {
            prizeCell.textContent = '-';
            prizeCell.style.color = '#666';
        }

        // Agregar celdas a la fila
        row.appendChild(positionCell);
        row.appendChild(nameCell);
        row.appendChild(numbersCell);
        row.appendChild(hitsCell);
        row.appendChild(gratisCell);
        row.appendChild(prizeCell);

        tableBody.appendChild(row);
    });
}

// Función principal para mostrar todos los resultados
function displayResults() {
    displayWinningNumbers();
    displaySummaryStats();
    displayResultsTable();
}

// Exportar resultados a CSV
function exportResults() {
    if (resultsData.length === 0) {
        alert('No hay datos para exportar');
        return;
    }

    let csvContent = 'Posición,Nombre,Números,Aciertos,Gratis,Premio\n';
    
    resultsData.forEach((player, index) => {
        const position = index + 1;
        const numbers = player.numbers.join('-');
        const gratis = player.gratis ? 'SÍ' : 'NO';
        const prize = player.prize > 0 ? `${player.prize} BS` : '-';
        
        csvContent += `${position},"${player.name}","${numbers}",${player.hits},${gratis},"${prize}"\n`;
    });

    // Agregar información de números ganadores
    csvContent += '\n\nNúmeros Ganadores\n';
    csvContent += winningNumbers.join(',') + '\n';

    // Crear y descargar archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const fileName = `resultados_${currentGameType}_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Imprimir resultados
function printResults() {
    window.print();
}

// Actualizar resultados en tiempo real (si se llama desde la página principal)
async function updateResults() {
    await loadAndDisplayData();
}

// Exportar funciones para uso global
window.exportResults = exportResults;
window.printResults = printResults;
window.updateResults = updateResults;
