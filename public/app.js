/**
 * Trimly - Frontend Controller & Analytics Engine
 * Day 8 URL Shortener
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements Selection
  const themeToggle = document.getElementById('theme-toggle');
  const dbBadge = document.getElementById('db-badge');
  const dbBadgeText = dbBadge.querySelector('.badge-text');
  
  const shortenForm = document.getElementById('shorten-form');
  const longUrlInput = document.getElementById('long-url');
  const customAliasInput = document.getElementById('custom-alias');
  const advancedToggle = document.getElementById('advanced-toggle');
  const advancedOptions = document.getElementById('advanced-options');
  const submitBtn = document.getElementById('submit-btn');
  const submitBtnText = submitBtn.querySelector('.btn-text');

  const linksLoader = document.getElementById('links-loader');
  const emptyState = document.getElementById('empty-state');
  const urlsList = document.getElementById('urls-list');
  const linkCountBadge = document.getElementById('link-count');
  const searchInput = document.getElementById('search-links');

  // Modals Selection
  const analyticsModal = document.getElementById('analytics-modal');
  const qrModal = document.getElementById('qr-modal');
  const closeModalBtns = document.querySelectorAll('.close-modal-btn');

  // QR Selection
  const qrImage = document.getElementById('qr-image');
  const qrLinkText = document.getElementById('qr-link-text');
  const downloadQrBtn = document.getElementById('download-qr-btn');
  
  // Analytics Elements Selection
  const modalShortLink = document.getElementById('modal-short-link');
  const modalOriginalLink = document.getElementById('modal-original-link');
  const statTotalClicks = document.getElementById('stat-total-clicks');
  const statCreatedDate = document.getElementById('stat-created-date');
  const statUniqueReferrers = document.getElementById('stat-unique-referrers');
  const referrersList = document.getElementById('referrers-list');

  // Chart instances trackers to prevent collision leaks
  let timelineChartInstance = null;
  let browserChartInstance = null;
  let osChartInstance = null;

  // Global state
  let activeLinksData = [];

  // Initialize Lucide Icons
  lucide.createIcons();

  // Check URL query parameters for redirection errors
  checkQueryParameters();

  // Initial Load Theme
  initTheme();

  // Load Saved Links
  loadLinks();

  // ==========================================================================
  // Theme Switching Implementation
  // ==========================================================================
  
  function initTheme() {
    const savedTheme = localStorage.getItem('trimly-theme');
    if (savedTheme === 'light') {
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
      document.body.classList.add('dark-theme');
    }
  }

  themeToggle.addEventListener('click', () => {
    const isDark = document.body.classList.contains('dark-theme');
    if (isDark) {
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
      localStorage.setItem('trimly-theme', 'light');
    } else {
      document.body.classList.remove('light-theme');
      document.body.classList.add('dark-theme');
      localStorage.setItem('trimly-theme', 'dark');
    }
  });

  // ==========================================================================
  // URL Redirection Error Check
  // ==========================================================================
  
  function checkQueryParameters() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'not_found') {
      const code = params.get('code') || '';
      showToast('Link Not Found', `The shortened link code "/${code}" does not exist in our system.`, 'error');
      // Clean URL bar
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('error') === 'server_error') {
      showToast('Redirection Failed', 'An internal server issue prevented redirection. Please try again.', 'error');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  // ==========================================================================
  // Form Accordion Trigger
  // ==========================================================================
  
  advancedToggle.addEventListener('click', () => {
    const isExpanded = advancedOptions.classList.contains('expanded');
    if (isExpanded) {
      advancedOptions.classList.remove('expanded');
      advancedToggle.classList.remove('active');
    } else {
      advancedOptions.classList.add('expanded');
      advancedToggle.classList.add('active');
    }
  });

  // ==========================================================================
  // Shortener Submit Event
  // ==========================================================================
  
  shortenForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const originalUrl = longUrlInput.value.trim();
    const customAlias = customAliasInput.value.trim();
    
    // UI Loading state
    submitBtn.disabled = true;
    submitBtnText.textContent = 'Trimming your link...';
    
    try {
      const response = await fetch('/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalUrl, customAlias })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to shorten URL');
      }
      
      showToast('Link Trimmed!', 'Your short URL has been successfully generated.', 'success');
      
      // Clear inputs
      longUrlInput.value = '';
      customAliasInput.value = '';
      
      // Close advanced toggle
      advancedOptions.classList.remove('expanded');
      advancedToggle.classList.remove('active');
      
      // Reload links
      await loadLinks();
      
    } catch (err) {
      console.error(err);
      showToast('Trimming Failed', err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtnText.textContent = 'Shorten Link';
    }
  });

  // ==========================================================================
  // Fetch and Render Saved Links
  // ==========================================================================
  
  async function loadLinks() {
    try {
      const response = await fetch('/api/urls');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to retrieve links');
      }
      
      // Update Database Badge status
      updateDbBadge(data.isFallback);
      
      activeLinksData = data.urls || [];
      renderLinks(activeLinksData);
      
    } catch (err) {
      console.error(err);
      linksLoader.classList.add('hidden');
      emptyState.classList.remove('hidden');
      showToast('Error Loading Links', err.message, 'error');
    }
  }

  function updateDbBadge(isFallback) {
    dbBadge.className = 'db-badge'; // Reset class
    if (isFallback) {
      dbBadge.classList.add('fallback');
      dbBadgeText.textContent = 'Local JSON DB';
      dbBadge.setAttribute('title', 'Running on file-based local storage fallback because MongoDB connection was unavailable.');
    } else {
      dbBadge.classList.add('mongodb');
      dbBadgeText.textContent = 'MongoDB Connected';
      dbBadge.setAttribute('title', 'Connected to active MongoDB instance.');
    }
  }

  function renderLinks(urls) {
    linksLoader.classList.add('hidden');
    
    // Count Badge
    linkCountBadge.textContent = `${urls.length} Link${urls.length === 1 ? '' : 's'}`;
    
    if (urls.length === 0) {
      emptyState.classList.remove('hidden');
      urlsList.classList.add('hidden');
      return;
    }
    
    emptyState.classList.add('hidden');
    urlsList.classList.remove('hidden');
    
    urlsList.innerHTML = '';
    
    urls.forEach(url => {
      const shortUrl = `${window.location.origin}/${url.shortCode}`;
      
      const item = document.createElement('div');
      item.className = 'link-item';
      item.innerHTML = `
        <div class="link-details">
          <div class="short-link-wrap">
            <a href="${shortUrl}" target="_blank" class="short-link-url">${window.location.host}/${url.shortCode}</a>
          </div>
          <a href="${url.originalUrl}" target="_blank" class="original-link-url" title="${url.originalUrl}">${url.originalUrl}</a>
          <div class="link-meta">
            <span class="meta-clicks" title="Total visits"><i data-lucide="eye"></i> ${url.clicks || 0} Click${url.clicks === 1 ? '' : 's'}</span>
            <span><i data-lucide="calendar"></i> ${formatDate(url.createdAt)}</span>
          </div>
        </div>
        <div class="link-actions">
          <button class="action-btn btn-copy" data-short="${shortUrl}" data-tooltip="Copy link" aria-label="Copy short link">
            <i data-lucide="copy" class="btn-icon"></i>
          </button>
          <button class="action-btn btn-qr" data-code="${url.shortCode}" data-short="${shortUrl}" data-tooltip="QR Code" aria-label="Show QR Code">
            <i data-lucide="qr-code"></i>
          </button>
          <button class="action-btn btn-stats" data-code="${url.shortCode}" data-tooltip="View Analytics" aria-label="Show Analytics">
            <i data-lucide="bar-chart-3"></i>
          </button>
          <button class="action-btn btn-delete" data-code="${url.shortCode}" data-tooltip="Delete link" aria-label="Delete shortened link">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      `;
      
      urlsList.appendChild(item);
    });
    
    // Reactivate icons
    lucide.createIcons();
    
    // Attach event listeners to items
    attachItemEventListeners();
  }

  function attachItemEventListeners() {
    // Copy short link action
    document.querySelectorAll('.btn-copy').forEach(btn => {
      btn.addEventListener('click', async () => {
        const link = btn.getAttribute('data-short');
        try {
          await navigator.clipboard.writeText(link);
          
          // Visual feedback checkmark
          btn.classList.add('copied');
          btn.innerHTML = `<i data-lucide="check"></i>`;
          lucide.createIcons();
          
          showToast('Copied to Clipboard!', 'Short link copied successfully.', 'success');
          
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = `<i data-lucide="copy"></i>`;
            lucide.createIcons();
          }, 2000);
          
        } catch (e) {
          showToast('Copy Failed', 'Please copy the link manually.', 'error');
        }
      });
    });

    // QR Modal Trigger
    document.querySelectorAll('.btn-qr').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.getAttribute('data-code');
        const shortUrl = btn.getAttribute('data-short');
        
        qrLinkText.textContent = `${window.location.host}/${code}`;
        
        // Show loading state
        const qrWrapper = qrModal.querySelector('.qr-code-wrapper');
        qrWrapper.querySelector('.qr-loading').classList.remove('hidden');
        
        const size = 200;
        const apiSrc = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(shortUrl)}&margin=10`;
        
        qrImage.src = apiSrc;
        
        qrImage.onload = () => {
          qrWrapper.querySelector('.qr-loading').classList.add('hidden');
        };
        
        qrModal.classList.remove('hidden');
        
        // Configure download button
        downloadQrBtn.onclick = () => {
          // Download directly from API
          window.open(apiSrc + '&download=1', '_blank');
        };
      });
    });

    // Analytics Modal Trigger
    document.querySelectorAll('.btn-stats').forEach(btn => {
      btn.addEventListener('click', async () => {
        const code = btn.getAttribute('data-code');
        await openAnalyticsModal(code);
      });
    });

    // Delete link action
    document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const code = btn.getAttribute('data-code');
        if (confirm(`Are you sure you want to delete the short URL /${code}?`)) {
          try {
            const response = await fetch(`/api/urls/${code}`, {
              method: 'DELETE'
            });
            const result = await response.json();
            
            if (!response.ok) {
              throw new Error(result.error || 'Failed to delete URL');
            }
            
            showToast('Link Deleted', 'Short URL removed successfully.', 'success');
            await loadLinks();
            
          } catch (e) {
            showToast('Deletion Failed', e.message, 'error');
          }
        }
      });
    });
  }

  // ==========================================================================
  // Search and Filter Links
  // ==========================================================================
  
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase().trim();
    if (!query) {
      renderLinks(activeLinksData);
      return;
    }
    
    const filtered = activeLinksData.filter(url => {
      return (
        url.shortCode.toLowerCase().includes(query) ||
        url.originalUrl.toLowerCase().includes(query)
      );
    });
    
    renderLinks(filtered);
  });

  // ==========================================================================
  // Modal Closing Mechanics
  // ==========================================================================
  
  closeModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      analyticsModal.classList.add('hidden');
      qrModal.classList.add('hidden');
      qrImage.src = ''; // reset QR image
    });
  });

  window.addEventListener('click', (e) => {
    if (e.target === analyticsModal) {
      analyticsModal.classList.add('hidden');
    }
    if (e.target === qrModal) {
      qrModal.classList.add('hidden');
      qrImage.src = '';
    }
  });

  // ==========================================================================
  // Toast Alerts Generator
  // ==========================================================================
  
  function showToast(title, message, type = 'success') {
    const container = document.getElementById('toast-container');
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' ? 'check-circle-2' : 'alert-circle';
    
    toast.innerHTML = `
      <div class="toast-icon"><i data-lucide="${icon}"></i></div>
      <div class="toast-content">
        <span class="toast-title">${title}</span>
        <span class="toast-message">${message}</span>
      </div>
    `;
    
    container.appendChild(toast);
    lucide.createIcons();
    
    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      toast.classList.add('removing');
      toast.addEventListener('transitionend', () => {
        toast.remove();
      });
    }, 4000);
  }

  // ==========================================================================
  // Helper Utility: Dates Formatter
  // ==========================================================================
  
  function formatDate(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  // ==========================================================================
  // Analytics charts rendering (Chart.js)
  // ==========================================================================
  
  async function openAnalyticsModal(code) {
    try {
      const response = await fetch(`/api/urls/${code}/analytics`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to retrieve analytics');
      }

      // Populate Quick Stats Text
      modalShortLink.textContent = `${window.location.host}/${data.shortCode}`;
      modalOriginalLink.textContent = data.originalUrl;
      modalOriginalLink.setAttribute('href', data.originalUrl);
      
      statTotalClicks.textContent = data.clicks || 0;
      statCreatedDate.textContent = formatDate(data.createdAt);
      
      const referrerKeys = Object.keys(data.breakdowns.referrers || {});
      statUniqueReferrers.textContent = referrerKeys.length;

      // Populate Referrers List
      populateReferrersBreakdown(data.breakdowns.referrers);

      // Clean up existing charts before drawing new ones to prevent collision leaks
      destroyCharts();

      // Show Analytics Modal Backdrop
      analyticsModal.classList.remove('hidden');

      // Instantiation Charts
      setTimeout(() => {
        renderTimelineChart(data.breakdowns.clicksOverTime);
        renderPieChart('browserChart', 'Browsers', data.breakdowns.browsers, ['#22d3ee', '#38bdf8', '#0ea5e9', '#0284c7', '#a855f7'], (instance) => browserChartInstance = instance);
        renderPieChart('osChart', 'OS', data.breakdowns.os, ['#ec4899', '#f43f5e', '#d946ef', '#c084fc', '#6366f1'], (instance) => osChartInstance = instance);
      }, 50);

    } catch (e) {
      console.error(e);
      showToast('Analytics Failed', e.message, 'error');
    }
  }

  function populateReferrersBreakdown(referrers) {
    referrersList.innerHTML = '';
    const items = Object.entries(referrers || {}).sort((a,b) => b[1] - a[1]);
    
    if (items.length === 0) {
      referrersList.innerHTML = `<div class="ref-row"><span class="ref-name" style="color: var(--text-muted)"><i data-lucide="help-circle"></i> No traffic tracked yet</span></div>`;
      lucide.createIcons();
      return;
    }
    
    items.forEach(([source, clicks]) => {
      const isDirect = source.toLowerCase().includes('direct');
      const icon = isDirect ? 'mail' : 'globe';
      
      const row = document.createElement('div');
      row.className = 'ref-row';
      row.innerHTML = `
        <span class="ref-name"><i data-lucide="${icon}"></i> ${source}</span>
        <span class="ref-clicks">${clicks} visit${clicks === 1 ? '' : 's'}</span>
      `;
      referrersList.appendChild(row);
    });
    
    lucide.createIcons();
  }

  function destroyCharts() {
    if (timelineChartInstance) {
      timelineChartInstance.destroy();
      timelineChartInstance = null;
    }
    if (browserChartInstance) {
      browserChartInstance.destroy();
      browserChartInstance = null;
    }
    if (osChartInstance) {
      osChartInstance.destroy();
      osChartInstance = null;
    }
  }

  function renderTimelineChart(clicksOverTime) {
    const ctx = document.getElementById('clicksTimelineChart').getContext('2d');
    
    const dates = Object.keys(clicksOverTime || {});
    const counts = Object.values(clicksOverTime || {});
    
    // Fallback display labels if no clicks recorded yet
    const labels = dates.length > 0 ? dates : [formatDate(new Date())];
    const data = counts.length > 0 ? counts : [0];

    // Theme responsive lines styling colors
    const isDark = document.body.classList.contains('dark-theme');
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
    const textColor = isDark ? '#94a3b8' : '#475569';
    const primaryColor = '#6366f1';
    
    // Gradient filling for high end look
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

    timelineChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.map(d => formatDate(d)),
        datasets: [{
          label: 'Clicks',
          data: data,
          borderColor: primaryColor,
          borderWidth: 3,
          backgroundColor: gradient,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: primaryColor,
          pointBorderColor: '#fff',
          pointBorderWidth: 1.5,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            padding: 10,
            cornerRadius: 8,
            titleFont: { family: 'Inter', size: 12, weight: 'bold' },
            bodyFont: { family: 'Inter', size: 12 },
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { family: 'Inter', size: 10 } }
          },
          y: {
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: { 
              color: textColor, 
              font: { family: 'Inter', size: 10 },
              stepSize: 1,
              precision: 0
            }
          }
        }
      }
    });
  }

  function renderPieChart(canvasId, title, breakdown, colors, saveInstanceFn) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    const items = Object.keys(breakdown || {});
    const counts = Object.values(breakdown || {});
    
    const labels = items.length > 0 ? items : ['No Data Tracked'];
    const data = counts.length > 0 ? counts : [1];
    const bgColors = items.length > 0 ? colors : ['rgba(255, 255, 255, 0.05)'];
    
    const isDark = document.body.classList.contains('dark-theme');
    const textColor = isDark ? '#94a3b8' : '#475569';

    const instance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: bgColors,
          borderWidth: isDark ? 2 : 1,
          borderColor: isDark ? '#111019' : '#fff',
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 12,
              padding: 10,
              color: textColor,
              font: { family: 'Inter', size: 11, weight: '500' }
            }
          },
          tooltip: {
            enabled: items.length > 0, // Disable tooltip if empty state
            padding: 8,
            cornerRadius: 6
          }
        },
        cutout: '70%'
      }
    });
    
    saveInstanceFn(instance);
  }
});
