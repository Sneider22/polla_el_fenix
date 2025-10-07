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
    let poteSemanal = 0;
    let acumulado = 0;
    let garantizado = 0;

    try {
        // Cargar potes para el juego actual
        const potesResult = await PotesDB.obtener(currentGameType);
        if (potesResult.success && potesResult.data) {
            const potData = potesResult.data;
            acumulado = potData.acumulado || 0;
            garantizado = potData.garantizado || 0;

            // Forzar que el pote del día actual sea 143 siempre
            const weekdayMap = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
            const todayName = weekdayMap[new Date().getDay()];

            const lunes = (todayName === 'lunes') ? 143 : (potData.lunes || 0);
            const martes = (todayName === 'martes') ? 143 : (potData.martes || 0);
            const miercoles = (todayName === 'miércoles') ? 143 : (potData.miércoles || 0);
            const jueves = (todayName === 'jueves') ? 143 : (potData.jueves || 0);
            const viernes = (todayName === 'viernes') ? 143 : (potData.viernes || 0);
            const sabado = (todayName === 'sábado') ? 143 : (potData.sábado || 0);
            const domingo = (todayName === 'domingo') ? 143 : (potData.domingo || 0);

            poteSemanal = lunes + martes + miercoles + jueves + viernes + sabado + domingo;
        } else {
            // Si no hay datos en BD, aun así el día actual debe aportar 143
            const weekdayMap = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
            const todayName = weekdayMap[new Date().getDay()];
            // Sumamos 143 para el día actual y 0 para los demás
            poteSemanal = 143; // porque el día actual siempre vale 143
        }

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
            const maxHits = currentGameType === 'polla' ? 6 : 3;

            // Calcular premios
            const precioJugada = 50;
            const gratisCount = resultsData.filter(p => p.gratis === true).length;
            const payingPlayersCount = resultsData.length - gratisCount;
            const premioTotal = payingPlayersCount * precioJugada;
            const recaudadoParaPremio = premioTotal * 0.8;
            
            // Calcular el pozo total para el premio mayor
            // Restar el pote semanal del pozo total (según especificación)
            let pozoTotal = recaudadoParaPremio + poteSemanal - 143;
            // Asegurar que no sea negativo
            if (pozoTotal < 0) pozoTotal = 0;

            const winnersWithMaxHits = resultsData.filter(player => player.hits === maxHits && !player.gratis);

            let prizeForMaxHits = 0;
            if (winnersWithMaxHits.length > 0) {
                prizeForMaxHits = Math.floor(pozoTotal / winnersWithMaxHits.length);
            }

            // Aplicar premio garantizado si es necesario
            if (winnersWithMaxHits.length > 0 && prizeForMaxHits < garantizado) {
                prizeForMaxHits = garantizado;
            }

            // Asignar premios a cada jugador
            resultsData.forEach(player => {
                if (player.hits === maxHits && !player.gratis) {
                    player.prize = prizeForMaxHits;
                } else {
                    player.prize = 0; // Otros premios se pueden calcular aquí si es necesario
                }
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
        console.error("Error cargando datos desde Supabase:", error);
        resultsData = [];
        winningNumbers = [];
    }
}

// Calcular premio según aciertos
function calculatePrize(hits, isGratis, maxHits, prizeForMaxHits, gameType) {
    if (isGratis) return 0;

    // El premio ya se calcula y asigna en loadDataFromSupabase
    // Esta función puede ser simplificada o eliminada si no se usa en otro lugar.
    const isCompleteWinner = (gameType === 'polla' && hits === 6) || 
                           (gameType === 'micro' && hits === 3);

    if (isCompleteWinner && prizeForMaxHits > 0) {
        return prizeForMaxHits;
    }
    
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
async function displaySummaryStats() {
    const maxPossibleHits = currentGameType === 'polla' ? 6 : 3;
    
    // Cargar datos del pote
    let poteSemanal = 0;
    let garantizado = 0;
    const potesResult = await PotesDB.obtener(currentGameType);
    if (potesResult.success && potesResult.data) {
        const potData = potesResult.data;
        garantizado = potData.garantizado || 0;

        const weekdayMap = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
        const todayName = weekdayMap[new Date().getDay()];

        const lunes = (todayName === 'lunes') ? 143 : (potData.lunes || 0);
        const martes = (todayName === 'martes') ? 143 : (potData.martes || 0);
        const miercoles = (todayName === 'miércoles') ? 143 : (potData.miércoles || 0);
        const jueves = (todayName === 'jueves') ? 143 : (potData.jueves || 0);
        const viernes = (todayName === 'viernes') ? 143 : (potData.viernes || 0);
        const sabado = (todayName === 'sábado') ? 143 : (potData.sábado || 0);
        const domingo = (todayName === 'domingo') ? 143 : (potData.domingo || 0);

        poteSemanal = lunes + martes + miercoles + jueves + viernes + sabado + domingo;
    } else {
        // Si no hay datos, el día actual siempre aporta 143
        poteSemanal = 143;
    }

    const fullHitWinners = resultsData.filter(player => player.hits === maxPossibleHits);
    const payingPlayersCount = resultsData.filter(player => !player.gratis).length;
    const payingWinners = fullHitWinners.filter(player => !player.gratis);

    const totalCollected = payingPlayersCount * 30;
    const recaudadoParaPremio = totalCollected * 0.8;
    // Restar el pote semanal del premio total según la nueva regla
    let prizePool = recaudadoParaPremio + poteSemanal - 143;
    if (prizePool < 0) prizePool = 0;

    let prizePerWinner = 0;
    if (payingWinners.length > 0) {
        prizePerWinner = Math.floor(prizePool / payingWinners.length);
    }

    // Aplicar garantizado
    if (payingWinners.length > 0 && prizePerWinner < garantizado) {
        prizePerWinner = garantizado;
    }

    // Actualizar título principal
    document.querySelector('.results-title').textContent = currentGameType === 'polla' ? 'RESULTADOS POLLA EL FÉNIX' : 'RESULTADOS MICRO';

    document.getElementById('totalPlayersResult').textContent = resultsData.length;

    // Actualizar dinámicamente el label de ganadores (siempre todos los aciertos posibles)
    const winnerLabel = document.getElementById('winnerLabel');
    if (winnerLabel) {
        winnerLabel.textContent = `Ganadores (${maxPossibleHits} aciertos)`;
    }
    document.getElementById('totalWinnersResult').textContent = fullHitWinners.length;
    document.getElementById('totalPrizeResult').textContent = `${prizePool.toFixed(0)} BS`;
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
        // Mostrar el nombre completo del jugador al pasar el cursor
        // tanto en la fila como en la celda del nombre (útil en pantallas pequeñas)
        row.title = player.name;

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

        // 1. ID Jugador
        const positionCell = document.createElement('td');
        positionCell.className = 'px-2 py-2 font-bold text-center text-gray-900';
        positionCell.textContent = player.id;
        if (player.hits === maxPossibleHits && player.hits > 0) {
            positionCell.innerHTML = `🏆 ${player.id}`;
        }

        // 2. Nombre
        const nameCell = document.createElement('td');
        nameCell.className = 'px-2 py-2 font-medium text-gray-900 truncate max-w-[220px] overflow-hidden bg-red text-clip max-sm:max-w-[20px] max-sm:text-[10px]';
        nameCell.textContent = player.name;
        // Asegurar que el title también esté en la celda del nombre para compatibilidad
        nameCell.title = player.name;

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
        hitsCell.className = 'px-6 py-4 text-center';
        hitsCell.className = 'px-2 sm:px-6 py-4 text-center';
        hitsCell.innerHTML = `<span class="bg-blue-600 text-white text-sm font-bold px-3 py-1 rounded-full">${player.hits}</span>`;

        // 5. Premio
        const prizeCell = document.createElement('td');
        prizeCell.className = 'px-6 py-4 text-center font-bold';
        prizeCell.className = 'px-2 sm:px-6 py-4 text-center font-bold';
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
async function displayResults() {
    displayWinningNumbers();
    await displaySummaryStats();

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

    let csvContent = 'ID,Nombre,Números,Aciertos,Gratis,Premio\n';
    
    dataToExport.forEach((player) => {
        const id = player.id;
        const numbers = player.numbers.join('-');
        const gratis = player.gratis ? 'SÍ' : 'NO';
        const prize = player.prize > 0 ? `${player.prize} BS` : '-';
        
        csvContent += `${id},"${player.name}","${numbers}",${player.hits},${gratis},"${prize}"\n`;
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
                // Asumo que existe una función `borrarTodas` en el objeto `JugadasPollaDB`
                deleteResult = await JugadasPollaDB.borrarTodas();
            } else {
                // Asumo que existe una función `borrarTodas` en el objeto `JugadasMicroDB`
                deleteResult = await JugadasMicroDB.borrarTodas();
            }

            if (deleteResult.success) {
                alert(`Todas las jugadas de la ${gameName} han sido borradas.`);
                await loadAndDisplayData(); // Recargar la vista para reflejar los cambios
            } else {
                // Usar un mensaje de error más detallado si está disponible
                const errorMessage = deleteResult.error ? deleteResult.error.message : 'Ocurrió un error desconocido.';
                alert(`Error al borrar las jugadas: ${errorMessage}`);
            }
        } catch (error) {
            console.error(`Error al intentar resetear las jugadas de ${gameName}:`, error);
            alert('Se produjo un error inesperado. Revisa la consola para más detalles.');
        }
    }
}

// Exportar funciones para uso global
window.exportResults = exportResults;
window.printResults = printResults;
window.updateResults = updateResults;
window.resetCurrentGame = resetCurrentGame;