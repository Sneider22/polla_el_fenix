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

    // Add search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            // No need to reload data, just re-display with filter
            displayResults(); 
        });
    }
});

function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');

const setActiveTab = (gameType) => {
        tabs.forEach(t => {
            if (t.dataset.game === gameType) {
                t.classList.add('bg-white', 'text-fenix-red');
                t.classList.remove('text-white');
            } else {
                t.classList.remove('bg-white', 'text-fenix-red');
                t.classList.add('text-[#a61c00]');
            }
        });
    };

    // Set initial active tab
    setActiveTab(currentGameType);

    tabs.forEach(tab => {
        tab.addEventListener('click', async () => {
            const newGameType = tab.dataset.game;
            if (newGameType === currentGameType) return;

            currentGameType = newGameType;
            setActiveTab(currentGameType);
            
            await loadAndDisplayData();
        });
    });
}

async function loadAndDisplayData() {
    await loadDataFromSupabase();
    displayResults();
}

async function loadDataFromSupabase() {
    // Limpiar datos anteriores para evitar "fugas" de una pestaña a otra
    resultsData = [];
    winningNumbers = [];
    try {
        // Cargar números ganadores según el tipo de juego
        let winningNumbersResult;
        if (currentGameType === 'polla') {
            winningNumbersResult = await ResultadosNumerosDB.obtenerUltimo();
        } else {
            winningNumbersResult = await ResultadosMicroDB.obtenerUltimo();
        }

        if (winningNumbersResult.success && winningNumbersResult.data && Array.isArray(winningNumbersResult.data.numeros_ganadores)) {
            winningNumbers = winningNumbersResult.data.numeros_ganadores.map(String); // Asegurar que sean strings para comparación
        } else {
            winningNumbers = [];
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
                // Para polla, el premio principal se reparte si hay ganadores con 6 aciertos
                prizeForMaxHits = (maxHits === 6 && winnersWithMaxHits.length > 0)
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

            // Añadir la posición después de ordenar
            resultsData.forEach((player, index) => {
                player.position = index + 1;
            });
        }
        // Si ticketsResult.success es falso, resultsData ya está como []
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
    
    // No hay premios fijos para 'micro' en esta implementación, o para otros casos de 'polla'
    return 0;
}

// Mostrar números ganadores
function displayWinningNumbers() {
    const container = document.getElementById('winningNumbersGrid');
    container.innerHTML = '';

    if (winningNumbers.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 col-span-full">No se han seleccionado números ganadores</p>';
        return;
    }

    winningNumbers.forEach(number => {
        const numberElement = document.createElement('div');
        // Usar caja cuadrada fija para consistencia (misma anchura/altura para 1 o 2 dígitos)
        numberElement.className = 'w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-md font-bold bg-yellow-400 text-black text-base shadow-md';
        numberElement.style.minWidth = '0';
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
    
    const totalCollected = payingPlayers.length * 30; // Total de dinero recaudado
    const prizePool = totalCollected * 0.8; // 80% para premios
    
    let prizePerWinner = 0;
    if (currentGameType === 'polla') {
        if (maxHits === 6 && payingWinners.length > 0) {
            prizePerWinner = Math.floor(prizePool / payingWinners.length);
        }
    } else { // micro
        if (maxHits === 3 && payingWinners.length > 0) {
            prizePerWinner = Math.floor(prizePool / payingWinners.length);
        }
    }

    // Actualizar título principal
    document.querySelector('.results-title').textContent = currentGameType === 'polla' ? 'RESULTADOS POLLA EL FÉNIX' : 'RESULTADOS MICRO';
    
    document.getElementById('totalPlayersResult').textContent = resultsData.length;
    
    // Actualizar dinámicamente el label de ganadores
    const winnerLabel = document.getElementById('winnerLabel');
    if (winnerLabel) {
        winnerLabel.textContent = `Ganadores (${maxHits} aciertos)`;
    }
    document.getElementById('totalWinnersResult').textContent = winnersWithMaxHits.length;
    document.getElementById('totalPrizeResult').textContent = `${totalCollected} BS`;
    document.getElementById('prizePerWinnerResult').textContent = prizePerWinner > 0 ? `${prizePerWinner} BS` : '0 BS';
}

// Mostrar tabla de resultados
function displayResultsTable(dataToDisplay) {
    const tableBody = document.getElementById('resultsTableBody');
    tableBody.innerHTML = '';

    if (dataToDisplay.length === 0) {
        const row = document.createElement('tr');
        const searchInput = document.getElementById('searchInput');
        const searchTerm = searchInput ? searchInput.value.trim() : '';
        if (searchTerm) {
            row.innerHTML = '<td colspan="6" class="text-center py-10 text-gray-500">No se encontraron jugadores con ese nombre.</td>';
        } else {
            row.innerHTML = '<td colspan="6" class="text-center py-10 text-gray-500">No hay datos de jugadores disponibles</td>';
        }
        tableBody.appendChild(row);
        return;
    }

    dataToDisplay.forEach((player) => {
        const row = document.createElement('tr');
        row.className = 'bg-white border-b hover:bg-gray-50';

        // Aplicar color de fondo según aciertos
        let bgColorClass = '';
        const maxPossibleHits = currentGameType === 'polla' ? 6 : 3;

        if (player.hits === maxPossibleHits && player.hits > 0) {
            bgColorClass = 'bg-[#02FF00]'; // Ganador principal
        } else if (currentGameType === 'polla') { // Colores intermedios solo para polla
            switch (player.hits) {
                case 5: bgColorClass = 'bg-[#1275fb]'; break;
                case 4: bgColorClass = 'bg-[#0077b6]'; break;
                case 3: bgColorClass = 'bg-[#03b3d8]'; break;
                case 2: bgColorClass = 'bg-[#4acae5]'; break;
                case 1: bgColorClass = 'bg-[#91e0f0]'; break;
            }
        } else if (currentGameType === 'micro') {
            // Para micro: asignar colores a 2 y 1 aciertos
            switch (player.hits) {
                case 2: bgColorClass = 'bg-[#03b3d8]'; break; // navy
                case 1: bgColorClass = 'bg-[#91e0f0]'; break; // light blue (azul muy claro)
                default: break; // 0 aciertos: sin color
            }
        }
        // Para micro, no se aplican colores intermedios, solo el de ganador principal.

        if (bgColorClass) {
            row.classList.add(bgColorClass);
        }

        // 1. Posición (compacta)
        const positionCell = document.createElement('td');
        positionCell.className = 'px-2 py-2 font-bold text-center text-gray-900';
        positionCell.textContent = player.position;
        if (player.hits === maxPossibleHits && player.hits > 0) {
            positionCell.innerHTML = `🏆 ${player.position}`;
        }

        // 2. Nombre
    const nameCell = document.createElement('td');
    nameCell.className = 'px-2 py-2 font-medium text-gray-900 truncate max-w-[220px]';
    nameCell.textContent = player.name;

        // 3. Números Jugados
        const numbersCell = document.createElement('td');
        numbersCell.className = 'px-2 py-2 text-center';
        // Representar números como cajas pequeñas y compactas
        numbersCell.innerHTML = `<div class="flex items-center justify-center gap-1 flex-nowrap">${
            player.numbers.map(number => {
                const isHit = winningNumbers.includes(number);
                if (isHit) {
                    // Verde militar uniforme para todos los números acertados
                    return `<span class="inline-flex items-center justify-center font-bold text-xs text-center rounded-md w-6 h-6 sm:w-7 sm:h-7" style="background-color: #06402b; color: #ffffff;">${number}</span>`;
                }
                const numberClass = 'bg-gray-200 text-gray-800';
                return `<span class="inline-flex items-center justify-center font-bold text-xs ${numberClass} text-center rounded-md w-6 h-6 sm:w-7 sm:h-7">${number}</span>`;
            }).join('')
        }</div>`;

        // 4. Aciertos
        const hitsCell = document.createElement('td');
        hitsCell.className = 'px-2 py-2 text-center';
        // Aciertos como cuadro compacto
        hitsCell.innerHTML = `<span class="inline-flex items-center justify-center bg-blue-600 text-white text-sm font-bold text-center rounded-md w-6 h-6 sm:w-7 sm:h-7">${player.hits}</span>`;

        // 5. Premio
    const prizeCell = document.createElement('td');
    prizeCell.className = 'px-2 py-2 text-center font-bold';
        if (player.prize > 0) {
            prizeCell.textContent = `${player.prize} BS`;
            prizeCell.className += ' text-black';
        } else {
            prizeCell.textContent = '-';
            prizeCell.className += ' text-gray-500';
        }

        // Agregar celdas a la fila
        row.appendChild(positionCell);
        row.appendChild(nameCell);
        row.appendChild(numbersCell);
        row.appendChild(hitsCell);
        row.appendChild(prizeCell);

        tableBody.appendChild(row);
    });
}

// Función principal para mostrar todos los resultados
function displayResults() {
    displayWinningNumbers();
    displaySummaryStats();

    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let filteredData = resultsData;
    if (searchTerm) {
        filteredData = resultsData.filter(player => 
            player.name.toLowerCase().includes(searchTerm)
        );
    }

    displayResultsTable(filteredData);
}

// Exportar resultados a CSV
function exportResults() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let dataToExport = resultsData;
    if (searchTerm) {
        dataToExport = resultsData.filter(player => 
            player.name.toLowerCase().includes(searchTerm)
        );
    }

    if (dataToExport.length === 0) {
        alert('No hay datos para exportar');
        return;
    }

    let csvContent = 'Posición,Nombre,Números,Aciertos,Gratis,Premio\n';
    
    dataToExport.forEach((player) => {
        const position = player.position;
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

async function resetCurrentGame() {
    // Mostrar modal de confirmación en lugar de confirm()
    const modal = document.getElementById('confirmResetModal');
    const cancelBtn = document.getElementById('cancelResetBtn');
    const confirmBtn = document.getElementById('confirmResetBtn');
    if (!modal || !cancelBtn || !confirmBtn) {
        console.error('Modal de confirmación no encontrado en el DOM. Asegúrate de que resultados.html contiene el modal.');
        return;
    }

    // Mostrar modal
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
        try {
            let deleteResult;
            if (currentGameType === 'polla') {
                deleteResult = await JugadasPollaDB.borrarTodas();
            } else {
                deleteResult = await JugadasMicroDB.borrarTodas();
            }

            if (deleteResult && deleteResult.success) {
                // No borrar números ganadores ni pote — sólo recargar las vistas
                showToast(`Todas las jugadas de la ${gameName} han sido borradas.`, 'success');
                await loadAndDisplayData();
            } else {
                const errorMessage = deleteResult && deleteResult.error ? deleteResult.error.message : 'Ocurrió un error desconocido.';
                showToast(`Error al borrar las jugadas: ${errorMessage}`, 'error');
            }
        } catch (error) {
            console.error(`Error al intentar resetear las jugadas de ${gameName}:`, error);
            showToast('Se produjo un error inesperado. Revisa la consola para más detalles.', 'error');
        }
    };

    cancelBtn.addEventListener('click', onCancel);
    confirmBtn.addEventListener('click', onConfirm);
}

// Exportar funciones para uso global
window.exportResults = exportResults;
window.printResults = printResults;
window.updateResults = updateResults;
window.resetCurrentGame = resetCurrentGame;