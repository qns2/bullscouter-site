/**
 * Bull Scouter - Chart.js wrappers
 * Sparklines for score trends, historical signal charts
 */

const Charts = (() => {
  // Shared Chart.js defaults for dark theme
  Chart.defaults.color = '#9ca3af';
  Chart.defaults.borderColor = '#1f2937';
  Chart.defaults.font.family = 'ui-monospace, monospace';
  Chart.defaults.font.size = 11;

  const chartInstances = {};

  function destroyChart(id) {
    if (chartInstances[id]) {
      chartInstances[id].destroy();
      delete chartInstances[id];
    }
  }

  /**
   * Render a sparkline in a canvas element.
   * @param {HTMLCanvasElement} canvas
   * @param {number[]} data - score values
   * @param {string} color - line color
   */
  function sparkline(canvas, data, color = '#22c55e') {
    if (!canvas || !data || data.length < 2) return;

    const ctx = canvas.getContext('2d');
    const id = canvas.id || Math.random().toString(36);
    destroyChart(id);

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, color + '33');
    gradient.addColorStop(1, color + '00');

    chartInstances[id] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map((_, i) => i),
        datasets: [{
          data: data,
          borderColor: color,
          backgroundColor: gradient,
          borderWidth: 1.5,
          pointRadius: 0,
          fill: true,
          tension: 0.3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: { display: false },
        },
        animation: { duration: 300 },
      }
    });
  }

  /**
   * Render signal count over time (BUY, WATCHLIST, MOMENTUM lines).
   * @param {string} canvasId
   * @param {Object[]} dailyData - array of {date, buy, watchlist, momentum}
   */
  function signalCountChart(canvasId, dailyData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !dailyData.length) return;

    destroyChart(canvasId);

    chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: dailyData.map(d => d.date),
        datasets: [
          {
            label: 'BUY',
            data: dailyData.map(d => d.buy),
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: '#22c55e',
            fill: true,
            tension: 0.2,
          },
          {
            label: 'WATCHLIST',
            data: dailyData.map(d => d.watchlist),
            borderColor: '#f59e0b',
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: '#f59e0b',
            fill: false,
            tension: 0.2,
          },
          {
            label: 'MOMENTUM',
            data: dailyData.map(d => d.momentum),
            borderColor: '#6b7280',
            borderWidth: 1.5,
            pointRadius: 2,
            pointBackgroundColor: '#6b7280',
            fill: false,
            tension: 0.2,
            borderDash: [4, 2],
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, padding: 16 } },
        },
        scales: {
          x: {
            grid: { color: '#1f2937' },
            ticks: { maxRotation: 45, font: { size: 10 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: '#1f2937' },
            ticks: { stepSize: 1, font: { size: 10 } },
          }
        },
      }
    });
  }

  /**
   * Render score distribution as a stacked bar chart.
   * @param {string} canvasId
   * @param {Object[]} dailyData - array of {date, scores: number[]}
   */
  function scoreDistChart(canvasId, dailyData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !dailyData.length) return;

    destroyChart(canvasId);

    // Bucket scores into ranges: <50, 50-64, 65-74, 75+
    const buckets = dailyData.map(d => {
      const scores = d.scores || [];
      return {
        date: d.date,
        low: scores.filter(s => s < 50).length,
        mid: scores.filter(s => s >= 50 && s < 65).length,
        watch: scores.filter(s => s >= 65 && s < 75).length,
        buy: scores.filter(s => s >= 75).length,
      };
    });

    chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: buckets.map(b => b.date),
        datasets: [
          { label: '75+ (BUY)', data: buckets.map(b => b.buy), backgroundColor: '#22c55e88' },
          { label: '65-74 (WATCH)', data: buckets.map(b => b.watch), backgroundColor: '#f59e0b88' },
          { label: '50-64', data: buckets.map(b => b.mid), backgroundColor: '#6b728088' },
          { label: '<50', data: buckets.map(b => b.low), backgroundColor: '#374151' },
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, padding: 16 } },
        },
        scales: {
          x: {
            stacked: true,
            grid: { color: '#1f2937' },
            ticks: { maxRotation: 45, font: { size: 10 } },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            grid: { color: '#1f2937' },
            ticks: { stepSize: 2, font: { size: 10 } },
          }
        },
      }
    });
  }

  /**
   * Render a ticker's score trajectory across dates.
   * @param {string} canvasId
   * @param {Object[]} entries - array of {date, score, recommendation}
   */
  function tickerTrajectory(canvasId, entries) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !entries.length) return;

    destroyChart(canvasId);

    const colors = entries.map(e => {
      if (e.recommendation === 'BUY') return '#22c55e';
      if (e.recommendation === 'WATCHLIST') return '#f59e0b';
      return '#6b7280';
    });

    chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: entries.map(e => e.date),
        datasets: [{
          label: 'Score',
          data: entries.map(e => e.score),
          borderColor: '#22c55e',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: colors,
          pointBorderColor: colors,
          fill: false,
          tension: 0.2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const e = entries[ctx.dataIndex];
                return `Score: ${e.score} (${e.recommendation})`;
              }
            }
          }
        },
        scales: {
          x: { grid: { color: '#1f2937' }, ticks: { maxRotation: 45, font: { size: 10 } } },
          y: {
            beginAtZero: false,
            grid: { color: '#1f2937' },
            ticks: { font: { size: 10 } },
          }
        }
      }
    });
  }

  return { sparkline, signalCountChart, scoreDistChart, tickerTrajectory, destroyChart };
})();
