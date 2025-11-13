// ============================================================================
// RECRUITMENT DASHBOARD - JAVASCRIPT
// Data processing, chart rendering, and UI updates
// ============================================================================

// Global state
let dashboardData = null;

// ============================================================================
// DATA LOADING AND INITIALIZATION
// ============================================================================

async function loadData() {
    try {
        const response = await fetch('recruitment_data.json');
        dashboardData = await response.json();
        initializeDashboard();
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Failed to load recruitment data. Please check the data file.');
    }
}

function initializeDashboard() {
    updateHeader();
    displayCriticalAlerts();
    updateKeyMetrics();
    renderCharts();
    updatePipelineBreakdown();
    populateJobPerformanceTable();
    populateRecruiterPerformanceTable();
    updateFooter();
}

// ============================================================================
// HEADER UPDATES
// ============================================================================

function updateHeader() {
    const dates = dashboardData.applicationDetails.map(d => new Date(d['Application Date']));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    
    const dateRangeEl = document.getElementById('dateRange');
    dateRangeEl.textContent = `Data Period: ${formatDate(minDate)} - ${formatDate(maxDate)}`;
}

// ============================================================================
// CRITICAL ALERTS
// ============================================================================

function displayCriticalAlerts() {
    const alertsSection = document.getElementById('alertsSection');
    const alerts = identifyCriticalIssues();
    
    if (alerts.length === 0) {
        alertsSection.innerHTML = '<div class="alert alert-medium"><div class="alert-icon">✅</div><div class="alert-content"><div class="alert-title">All Clear</div><div class="alert-message">No critical issues identified in the pipeline.</div></div></div>';
        return;
    }
    
    alertsSection.innerHTML = alerts.map(alert => `
        <div class="alert alert-${alert.severity.toLowerCase()}">
            <div class="alert-icon">${alert.icon}</div>
            <div class="alert-content">
                <div class="alert-title">${alert.title}</div>
                <div class="alert-message">${alert.message}</div>
            </div>
        </div>
    `).join('');
}

function identifyCriticalIssues() {
    const alerts = [];
    const funnel = calculateConversionFunnel();
    const pipeline = calculatePipelineBreakdown();
    const weeklyTrend = dashboardData.applicationsOverTime;
    
    // Check for zero hires
    if (funnel.hired === 0 && funnel.offered > 0) {
        alerts.push({
            severity: 'CRITICAL',
            icon: '🚨',
            title: 'Zero Hires from Offers',
            message: `${funnel.offered} offers have been extended but 0 hires have been completed. Immediate action required to identify and resolve onboarding bottlenecks.`
        });
    }
    
    // Check for pipeline bottleneck
    if (pipeline.advancedStage.percentage > 40) {
        alerts.push({
            severity: 'HIGH',
            icon: '⚠️',
            title: 'Pipeline Bottleneck Detected',
            message: `${pipeline.advancedStage.percentage.toFixed(1)}% of applications are stuck in the documentation stage. Review document requirements and candidate support processes.`
        });
    }
    
    // Check for declining volume
    if (weeklyTrend.length >= 2) {
        const lastWeek = weeklyTrend[weeklyTrend.length - 1]['CountDistinct of APPLICANT_ID'];
        const prevWeek = weeklyTrend[weeklyTrend.length - 2]['CountDistinct of APPLICANT_ID'];
        if (lastWeek < prevWeek * 0.5) {
            alerts.push({
                severity: 'MEDIUM',
                icon: '📉',
                title: 'Application Volume Decline',
                message: `Most recent week shows ${lastWeek} application(s), down from ${prevWeek}. Consider refreshing job postings or expanding sourcing channels.`
            });
        }
    }
    
    // Check for stale job postings
    const staleJobs = dashboardData.byTeamJob.filter(job => job['Days Open'] > 300);
    if (staleJobs.length > 0) {
        alerts.push({
            severity: 'MEDIUM',
            icon: '📋',
            title: 'Stale Job Postings',
            message: `${staleJobs.length} job posting(s) have been open for over 300 days with minimal traction. Consider closing or refreshing these positions.`
        });
    }
    
    return alerts;
}

// ============================================================================
// KEY METRICS
// ============================================================================

function updateKeyMetrics() {
    const funnel = calculateConversionFunnel();
    const timeMetrics = calculateTimeMetrics();
    
    document.getElementById('totalApplications').textContent = funnel.applications;
    document.getElementById('viewedRate').textContent = `${(funnel.viewedRate * 100).toFixed(1)}%`;
    document.getElementById('interviewRate').textContent = `${(funnel.interviewRate * 100).toFixed(1)}%`;
    document.getElementById('offerRate').textContent = `${(funnel.offerRate * 100).toFixed(1)}%`;
    document.getElementById('hireRate').textContent = `${(funnel.hireRate * 100).toFixed(1)}%`;
    document.getElementById('avgTimeToOffer').textContent = `${timeMetrics.appToOffer.toFixed(1)} days`;
}

function calculateConversionFunnel() {
    const total = dashboardData.applicationDetails.length;
    const viewed = dashboardData.applicationDetails.filter(d => d['Viewed By']).length;
    const interviewed = dashboardData.applicationDetails.filter(d => d['Interview Date']).length;
    const offered = dashboardData.applicationDetails.filter(d => d['Offer Date']).length;
    const hired = dashboardData.applicationDetails.filter(d => d['Hire Date']).length;
    
    return {
        applications: total,
        viewed,
        viewedRate: viewed / total,
        interviewed,
        interviewRate: interviewed / total,
        offered,
        offerRate: offered / total,
        hired,
        hireRate: hired / total
    };
}

function calculateTimeMetrics() {
    const details = dashboardData.applicationDetails;
    
    const appToView = calculateAverageDays(details, 'Application Date', 'Viewed Date');
    const viewToInterview = calculateAverageDays(details, 'Viewed Date', 'Interview Date');
    const interviewToOffer = calculateAverageDays(details, 'Interview Date', 'Offer Date');
    const appToOffer = calculateAverageDays(details, 'Application Date', 'Offer Date');
    
    return { appToView, viewToInterview, interviewToOffer, appToOffer };
}

function calculateAverageDays(data, startField, endField) {
    const validRecords = data.filter(d => d[startField] && d[endField]);
    if (validRecords.length === 0) return 0;
    
    const totalDays = validRecords.reduce((sum, record) => {
        const start = new Date(record[startField]);
        const end = new Date(record[endField]);
        const days = (end - start) / (1000 * 60 * 60 * 24);
        return sum + days;
    }, 0);
    
    return totalDays / validRecords.length;
}

// ============================================================================
// PIPELINE BREAKDOWN
// ============================================================================

function calculatePipelineBreakdown() {
    const statusCategories = {
        earlyStage: ['New', 'Initial Contact Attempted', '2nd Contact Attempted', '3rd Contact Attempted'],
        activeEngagement: ['In Communication', 'Interview Scheduled', 'Interview Cancelled'],
        advancedStage: ['Sent Documents', 'Documents Signed'],
        closed: ['Not Qualified', 'No Offer Made', 'Sent Application']
    };
    
    const statusData = dashboardData.applicantsByStatus;
    const total = statusData.reduce((sum, s) => sum + s.Applicants, 0);
    
    const breakdown = {};
    for (const [key, statuses] of Object.entries(statusCategories)) {
        const count = statusData
            .filter(s => statuses.includes(s['Application State']))
            .reduce((sum, s) => sum + s.Applicants, 0);
        breakdown[key] = {
            count,
            percentage: (count / total * 100)
        };
    }
    
    return breakdown;
}

function updatePipelineBreakdown() {
    const pipeline = calculatePipelineBreakdown();
    const pipelineGrid = document.getElementById('pipelineGrid');
    
    const stages = [
        { key: 'earlyStage', title: 'Early Stage', description: 'New & Contact Attempts' },
        { key: 'activeEngagement', title: 'Active Engagement', description: 'Communication & Interviews' },
        { key: 'advancedStage', title: 'Advanced Stage', description: 'Documentation Process' },
        { key: 'closed', title: 'Closed', description: 'Disqualified or Rejected' }
    ];
    
    pipelineGrid.innerHTML = stages.map(stage => {
        const data = pipeline[stage.key];
        return `
            <div class="pipeline-stage">
                <div class="pipeline-stage-title">${stage.title}</div>
                <div class="pipeline-stage-count">${data.count}</div>
                <div class="pipeline-stage-percentage">${data.percentage.toFixed(1)}% of pipeline</div>
                <div class="pipeline-stage-bar">
                    <div class="pipeline-stage-bar-fill" style="width: ${data.percentage}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================================================
// CHARTS
// ============================================================================

function renderCharts() {
    renderWeeklyTrendChart();
    renderFunnelChart();
    renderStatusChart();
    renderJobTypeChart();
}

function renderWeeklyTrendChart() {
    const ctx = document.getElementById('weeklyTrendChart').getContext('2d');
    const data = dashboardData.applicationsOverTime;
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => formatWeek(d['Week of APPLICATION_DATE'])),
            datasets: [{
                label: 'Applications',
                data: data.map(d => d['CountDistinct of APPLICANT_ID']),
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 2 },
                    grid: { color: 'rgba(0, 0, 0, 0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function renderFunnelChart() {
    const ctx = document.getElementById('funnelChart').getContext('2d');
    const funnel = calculateConversionFunnel();
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Applications', 'Viewed', 'Interviewed', 'Offered', 'Hired'],
            datasets: [{
                label: 'Count',
                data: [
                    funnel.applications,
                    funnel.viewed,
                    funnel.interviewed,
                    funnel.offered,
                    funnel.hired
                ],
                backgroundColor: [
                    '#3b82f6',
                    '#06b6d4',
                    '#10b981',
                    '#f59e0b',
                    '#ef4444'
                ],
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const percentage = (context.parsed.x / funnel.applications * 100).toFixed(1);
                            return `${context.parsed.x} (${percentage}%)`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' }
                },
                y: {
                    grid: { display: false }
                }
            }
        }
    });
}

function renderStatusChart() {
    const ctx = document.getElementById('statusChart').getContext('2d');
    const data = dashboardData.applicantsByStatus
        .sort((a, b) => b.Applicants - a.Applicants);
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d['Application State']),
            datasets: [{
                label: 'Applicants',
                data: data.map(d => d.Applicants),
                backgroundColor: '#2563eb',
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { stepSize: 2 },
                    grid: { color: 'rgba(0, 0, 0, 0.05)' }
                },
                y: {
                    grid: { display: false }
                }
            }
        }
    });
}

function renderJobTypeChart() {
    const ctx = document.getElementById('jobTypeChart').getContext('2d');
    
    const jobCounts = {};
    dashboardData.applicationDetails.forEach(app => {
        const jobTitle = app['Job Title'];
        jobCounts[jobTitle] = (jobCounts[jobTitle] || 0) + 1;
    });
    
    const labels = Object.keys(jobCounts);
    const data = Object.values(jobCounts);
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#ef4444'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { padding: 15, font: { size: 12 } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = (context.parsed / total * 100).toFixed(1);
                            return `${context.label}: ${context.parsed} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// ============================================================================
// TABLES
// ============================================================================

function populateJobPerformanceTable() {
    const tbody = document.querySelector('#jobPerformanceTable tbody');
    const jobs = dashboardData.byTeamJob;
    
    tbody.innerHTML = jobs.map(job => {
        const appsPerDay = (job['Total Applicants'] / job['Days Open']).toFixed(2);
        return `
            <tr>
                <td>${job['Job Name']}</td>
                <td>${job['Job Owner']}</td>
                <td>${job['Total Applicants']}</td>
                <td>${job['Days Open']}</td>
                <td>${appsPerDay}</td>
            </tr>
        `;
    }).join('');
}

function populateRecruiterPerformanceTable() {
    const tbody = document.querySelector('#recruiterPerformanceTable tbody');
    const recruiterStats = calculateRecruiterPerformance();
    
    tbody.innerHTML = Object.entries(recruiterStats).map(([name, stats]) => `
        <tr>
            <td>${name}</td>
            <td>${stats.applications}</td>
            <td>${stats.viewed}</td>
            <td>${stats.interviewed}</td>
            <td>${stats.offered}</td>
            <td>${stats.viewRate.toFixed(1)}%</td>
            <td>${stats.interviewRate.toFixed(1)}%</td>
            <td>${stats.offerRate.toFixed(1)}%</td>
        </tr>
    `).join('');
}

function calculateRecruiterPerformance() {
    const stats = {};
    
    dashboardData.applicationDetails.forEach(app => {
        const owner = app['Job Owner'];
        if (!stats[owner]) {
            stats[owner] = {
                applications: 0,
                viewed: 0,
                interviewed: 0,
                offered: 0
            };
        }
        
        stats[owner].applications++;
        if (app['Viewed By']) stats[owner].viewed++;
        if (app['Interview Date']) stats[owner].interviewed++;
        if (app['Offer Date']) stats[owner].offered++;
    });
    
    // Calculate rates
    for (const owner in stats) {
        const s = stats[owner];
        s.viewRate = (s.viewed / s.applications * 100);
        s.interviewRate = (s.interviewed / s.applications * 100);
        s.offerRate = (s.offered / s.applications * 100);
    }
    
    return stats;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatDate(date) {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatWeek(weekString) {
    const date = new Date(weekString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function updateFooter() {
    document.getElementById('lastUpdated').textContent = new Date().toLocaleString();
}

function showError(message) {
    const alertsSection = document.getElementById('alertsSection');
    alertsSection.innerHTML = `
        <div class="alert alert-critical">
            <div class="alert-icon">❌</div>
            <div class="alert-content">
                <div class="alert-title">Error Loading Dashboard</div>
                <div class="alert-message">${message}</div>
            </div>
        </div>
    `;
}

// ============================================================================
// INITIALIZE ON PAGE LOAD
// ============================================================================

document.addEventListener('DOMContentLoaded', loadData);