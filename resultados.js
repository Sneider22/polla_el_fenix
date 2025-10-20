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

    // Add copy functionality for Pago Móvil
    const copyButton = document.getElementById('copyPagoMovil');
    if (copyButton) {
        copyButton.addEventListener('click', () => {
            const telefono = document.getElementById('pagoMovilTelefono').innerText;
            const cedula = document.getElementById('pagoMovilCedula').innerText;
            const banco = document.getElementById('pagoMovilBanco').innerText;
            const bancoNombre = 'BANESCO'; // Hardcoded as it was before

            const textToCopy = `Pago Móvil\nTeléfono: ${telefono}\nCédula: ${cedula}\nBanco: ${banco} - ${bancoNombre}`;

            navigator.clipboard.writeText(textToCopy).then(() => {
                // Optional: Show a success message
                const originalText = copyButton.innerText;
                copyButton.innerText = '¡Copiado!';
                setTimeout(() => {
                    copyButton.innerText = originalText;
                }, 2000);
            }).catch(err => {
                console.error('Error al copiar datos: ', err);
                alert('Error al copiar los datos.');
            });
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
    generatePreviewImage(); // Generar imagen preliminar después de cargar datos
}

async function loadDataFromSupabase() {
    // Limpiar datos anteriores para evitar "fugas" de una pestaña a otra
    resultsData = [];
    winningNumbers = [];
    let poteSemanal = 0;
    let acumulado = 0;
    let garantizado = 0;
    let poteDiario = 0;

    try {
        // Cargar potes para el juego actual
        const potesResult = await PotesDB.obtener(currentGameType);
        let potData = null; // Declarar fuera del bloque if
        if (potesResult.success && potesResult.data) {
            potData = potesResult.data;
            acumulado = potData.acumulado || 0;
            garantizado = potData.garantizado || 0;

            // Obtener el día actual para el pote diario automático
            const weekdayMap = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
            const todayName = weekdayMap[new Date().getDay()];
            poteDiario = potData[todayName] || 0;
            poteSemanal = potData.poteSemanal || 0;
        } else {
            const weekdayMap = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
            const todayName = weekdayMap[new Date().getDay()];
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
            
            let seqCounter = 1;
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

                    const player = {
                        id: ticket.id,
                        seq_id: seqCounter++,
                        name: playerName,
                        numbers: playerNumbers,
                        hits: hits,
                        gratis: ticket.gratis,
                        prize: 0 // Se calculará después
                    };

                    return player;
                });

            // Encontrar el número máximo de aciertos
            const maxHits = currentGameType === 'polla' ? 6 : 3;

            // Calcular premios
            const precioJugada = potData ? (potData.precioJugada || 50) : 50;
            const gratisCount = resultsData.filter(p => p.gratis === true).length;
            const payingPlayersCount = resultsData.length - gratisCount;
            const premioTotal = payingPlayersCount * precioJugada;
            const recaudadoParaPremio = premioTotal * 0.8;

            // Calcular el pozo total para el premio mayor según la nueva fórmula
            const pozoTotal = recaudadoParaPremio + poteDiario + poteSemanal + acumulado + garantizado;
            // Asegurar que no sea negativo
            if (pozoTotal < 0) pozoTotal = 0;

            const winnersWithMaxHits = resultsData.filter(player => player.hits === maxHits);

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
                if (player.hits === maxHits) {
                    player.prize = prizeForMaxHits;
                } else {
                    player.prize = 0;
                }
            });

            // Ordenar por aciertos (descendente) y luego por seq_id si no hay aciertos, o por nombre
            resultsData.sort((a, b) => {
                if (a.hits !== b.hits) {
                    return b.hits - a.hits;
                } else {
                    if (a.hits === 0) {
                        return a.seq_id - b.seq_id; // Ordenar por # cuando no hay aciertos
                    } else {
                        return a.name.localeCompare(b.name);
                    }
                }
            });

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
    let poteDiario = 0;
   let precioJugada = 50;
    let garantizado = 0;
    let acumulado = 0;
    let potData = null;
    const potesResult = await PotesDB.obtener(currentGameType);
    if (potesResult.success && potesResult.data) {
        potData = potesResult.data;
        precioJugada = potData.precioJugada || 50;
        garantizado = potData.garantizado || 0;
        acumulado = potData.acumulado || 0;
        poteSemanal = potData.poteSemanal || 0;
        poteDiario = potData.poteDiario || 0;
    } 
        console.log("potData", potData);
    
    const fullHitWinners = resultsData.filter(player => player.hits === maxPossibleHits);
    const payingPlayersCount = resultsData.filter(player => !player.gratis).length;

    const totalCollected = payingPlayersCount * precioJugada;
    const recaudadoParaPremio = totalCollected * 0.8;
    // Calcular el pozo total para el premio mayor según la nueva fórmula
    let prizePool = recaudadoParaPremio + poteDiario + poteSemanal + garantizado + acumulado;

    // Calcular premio sin pote semanal (solo recaudación + acumulado + garantizado)
    let prizePoolWithoutWeekly = recaudadoParaPremio + garantizado + acumulado;

    if (prizePool < 0) prizePool = 0;
    if (prizePoolWithoutWeekly < 0) prizePoolWithoutWeekly = 0;

    let prizePerWinner = 0;
    if (fullHitWinners.length > 0) {
        prizePerWinner = Math.floor(prizePool / fullHitWinners.length);
    }
    // Aplicar garantizado
    if (fullHitWinners.length > 0 && prizePerWinner < garantizado) {
        prizePerWinner = garantizado;
    }

    // Actualizar el valor de la jugada en la UI de resultados
    const precioJugadaResultValueEl = document.getElementById('precioJugadaResultValue');
    if (precioJugadaResultValueEl) {
        precioJugadaResultValueEl.textContent = precioJugada;
    }

    // Actualizar título principal
    document.querySelector('.results-title').textContent = currentGameType === 'polla' ? '🐦‍🔥 RESULTADOS POLLA EL FÉNIX 🐦‍🔥' : '🐦‍🔥 RESULTADOS MICRO FÉNIX 🐦‍🔥';

    document.getElementById('totalPlayersResult').textContent = resultsData.length;

    // Actualizar dinámicamente el label de ganadores (siempre todos los aciertos posibles)
    const winnerLabel = document.getElementById('winnerLabel');
    if (winnerLabel) {
        winnerLabel.textContent = `Ganadores (${maxPossibleHits} aciertos)`;
    }
    document.getElementById('totalWinnersResult').textContent = fullHitWinners.length;

    // Mostrar premio sin pote semanal y con pote semanal
    document.getElementById('totalPrizeWithoutWeekly').textContent = `${prizePoolWithoutWeekly.toFixed(0)} BS`;
    document.getElementById('totalPrizeWithWeekly').textContent = `${prizePool.toFixed(0)} BS`;

    document.getElementById('prizePerWinnerResult').textContent = prizePerWinner > 0 ? `${prizePerWinner} BS` : '0 BS';
}

// Mostrar tabla de resultados
async function displayResultsTable(dataToDisplay) {
    const tableBody = document.getElementById('resultsTableBody');
    console.log("dataToDisplay", dataToDisplay);
    
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
        console.log("player", player);
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
        positionCell.textContent = player.seq_id;
        if (player.hits === maxPossibleHits && player.hits > 0) {
            positionCell.innerHTML = `🏆 ${player.seq_id}`;
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
        hitsCell.innerHTML = `<span class="bg-pink-600 text-white text-sm font-bold px-3 py-1 rounded-full">${player.hits}</span>`;

        // 5. Premio
        const prizeCell = document.createElement('td');
        prizeCell.className = 'px-6 py-4 text-center font-bold';
        prizeCell.className = 'px-2 sm:px-6 py-4 text-center font-bold';
        if (player.prize > 0) {
            // Obtener el premio por ganador desde el elemento de estadísticas para mantener consistencia
            const prizePerWinnerElement = document.getElementById('prizePerWinnerResult');
            const prizeText = prizePerWinnerElement ? prizePerWinnerElement.textContent : `${player.prize} BS`;
            prizeCell.textContent = prizeText;
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
        const id = player.seq_id;
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

// Función para resetear el juego actual (eliminar todas las jugadas)
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
                // Usar la función truncate para eliminar todas las jugadas de polla
                deleteResult = await truncateJugadasPolla();
            } else {
                // Usar la función truncate para eliminar todas las jugadas de micro
                deleteResult = await truncateJugadasMicro();
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
    };

    // Añadir event listeners
    cancelBtn.addEventListener('click', onCancel);
    confirmBtn.addEventListener('click', onConfirm);
}

// Función para generar imagen preliminar dinámica
function generatePreviewImage() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 1200;
    canvas.height = 630;

    // Fondo con gradiente similar al sitio
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#f8d74b');
    gradient.addColorStop(1, '#ffc000');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Título
    ctx.fillStyle = '#a61c00';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🐦‍🔥 RESULTADOS POLLA EL FÉNIX 🐦‍🔥', canvas.width / 2, 60);

    // Números ganadores
    if (winningNumbers.length > 0) {
        ctx.fillStyle = '#000';
        ctx.font = 'bold 24px Arial';
        ctx.fillText('Números Ganadores:', canvas.width / 2, 120);

        winningNumbers.forEach((num, index) => {
            ctx.fillStyle = '#06402b';
            ctx.fillRect(canvas.width / 2 - 150 + index * 50, 140, 40, 40);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(num, canvas.width / 2 - 130 + index * 50, 165);
        });
    }

    // Estadísticas
    ctx.fillStyle = '#000';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Total Jugadas: ${resultsData.length}`, 50, 250);
    ctx.fillText(`Ganadores: ${resultsData.filter(p => p.hits === (currentGameType === 'polla' ? 6 : 3)).length}`, 50, 300);
    ctx.fillText(`Premio Total: ${document.getElementById('totalPrizeWithWeekly').textContent}`, 50, 350);
    ctx.fillText(`Premio por Ganador: ${document.getElementById('prizePerWinnerResult').textContent}`, 50, 400);

    // Logo o imagen adicional (opcional)
    const logo = new Image();
    logo.onload = () => {
        ctx.drawImage(logo, canvas.width - 150, canvas.height - 150, 120, 120);
        updateMetaTags(canvas.toDataURL());
    };
    logo.onerror = () => {
        updateMetaTags(canvas.toDataURL());
    };
    logo.src = 'Logo Fenix.png'; // Ajusta la ruta si es necesario
}

// Función para actualizar meta tags con la imagen generada
function updateMetaTags(imageDataUrl) {
    const currentUrl = window.location.href;
    document.querySelector('meta[property="og:title"]').setAttribute('content', `Resultados del Día - ${currentGameType === 'polla' ? 'Polla' : 'Micro'} El Fénix`);
    document.querySelector('meta[property="og:description"]').setAttribute('content', `Resultados de hoy: ${winningNumbers.join(', ')} | Jugadas: ${resultsData.length} | Premio con pote: ${document.getElementById('totalPrizeWithWeekly').textContent} | Premio por ganador: ${document.getElementById('prizePerWinnerResult').textContent}`);
    document.querySelector('meta[property="og:image"]').setAttribute('content', imageDataUrl);
    document.querySelector('meta[property="og:url"]').setAttribute('content', currentUrl);
    document.querySelector('meta[name="twitter:card"]').setAttribute('content', 'summary_large_image');
}

// Función para hacer scroll suave a la tabla
function scrollToTable() {
    const tableSection = document.getElementById('resultsTableSection');
    if (tableSection) {
        tableSection.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// Agregar event listener al botón flotante cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    const scrollButton = document.getElementById('scrollToTable');
    if (scrollButton) {
        scrollButton.addEventListener('click', scrollToTable);
    }
});