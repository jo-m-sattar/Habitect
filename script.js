// Mobile Navigation
const navToggle = document.getElementById('nav-toggle');
const navMenu = document.getElementById('nav-menu');

if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        navToggle.classList.toggle('active');
    });
}

// Close mobile menu when clicking on a link
document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (navMenu.classList.contains('active')) {
                navMenu.classList.remove('active');
                navToggle.classList.remove('active');
            }
        });
    });
});

// Scroll Reveal Animation
const revealElements = document.querySelectorAll('.reveal');

const revealOnScroll = () => {
    const windowHeight = window.innerHeight;
    const revealPoint = 150;

    revealElements.forEach(element => {
        const elementTop = element.getBoundingClientRect().top;
        
        if (elementTop < windowHeight - revealPoint) {
            element.classList.add('active');
        }
    });
};

// Initialize reveal on load and scroll
window.addEventListener('scroll', revealOnScroll);
window.addEventListener('load', revealOnScroll);
window.addEventListener('resize', revealOnScroll);

// Force check on load to ensure elements are revealed
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(revealOnScroll, 100);
});

// Toast Notification System
class ToastSystem {
    constructor() {
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
    }

    show(message, severity = 'info', duration = 5000) {
        const toast = document.createElement('div');
        toast.className = `toast ${severity}`;
        toast.innerHTML = `
            <div class="toast-content">
                <strong>${severity.toUpperCase()}</strong>
                <p>${message}</p>
            </div>
        `;

        this.container.appendChild(toast);

        // Auto remove after duration
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'slideOut 0.3s ease forwards';
                setTimeout(() => toast.remove(), 300);
            }
        }, duration);

        return toast;
    }
}

// Initialize toast system
const toastSystem = new ToastSystem();

// Rigel Demo Connection System
class RigelDemo {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.telemetryData = {};
        this.alertsHistory = [];
        this.telemetryIntervals = [];
        this.alertIntervals = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadAlertsHistory();
    }

    bindEvents() {
        const connectBtn = document.getElementById('connect-rigel');
        const disconnectBtn = document.getElementById('disconnect-rigel');

        if (connectBtn) {
            connectBtn.addEventListener('click', () => this.connect());
        }

        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', () => this.disconnect());
        }
    }

    connect() {
        try {
            // Check if we're running with Node server
            if (typeof io !== 'undefined') {
                // Real Socket.IO connection
                this.socket = io();
                
                this.socket.on('connect', () => {
                    this.isConnected = true;
                    this.updateConnectionStatus();
                    toastSystem.show('Connected to Rigel AI', 'info');
                });

                this.socket.on('telemetry', (data) => this.handleTelemetry(data));
                this.socket.on('alert', (alert) => this.handleAlert(alert));
                this.socket.on('init', (data) => this.handleInit(data));
                
                this.socket.on('disconnect', () => {
                    this.isConnected = false;
                    this.updateConnectionStatus();
                    toastSystem.show('Disconnected from Rigel AI', 'warning');
                });

                this.socket.on('connect_error', (error) => {
                    console.error('Connection error:', error);
                    toastSystem.show('Failed to connect to Rigel server', 'critical');
                    this.fallbackToSimulation();
                });
            } else {
                // Fallback to simulation mode
                this.fallbackToSimulation();
            }

        } catch (error) {
            console.error('Connection failed:', error);
            toastSystem.show('Failed to connect to Rigel server, running in simulation mode', 'warning');
            this.fallbackToSimulation();
        }
    }

    fallbackToSimulation() {
        this.isConnected = true;
        this.updateConnectionStatus();
        toastSystem.show('Running in simulation mode', 'info');

        // Simulate telemetry data
        const telemetryInterval = setInterval(() => {
            const telemetry = this.generateTelemetry();
            this.handleTelemetry(telemetry);
        }, 2000);
        this.telemetryIntervals.push(telemetryInterval);

        // Simulate occasional alerts
        const alertInterval = setInterval(() => {
            if (Math.random() < 0.1) { // 10% chance every interval
                const alert = this.generateAlert();
                this.handleAlert(alert);
            }
        }, 10000);
        this.alertIntervals.push(alertInterval);
    }

    disconnect() {
        // Clear all intervals
        this.telemetryIntervals.forEach(interval => clearInterval(interval));
        this.alertIntervals.forEach(interval => clearInterval(interval));
        this.telemetryIntervals = [];
        this.alertIntervals = [];

        // Disconnect socket if exists
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }

        this.isConnected = false;
        this.updateConnectionStatus();
        toastSystem.show('Disconnected from Rigel AI', 'info');
    }

    handleInit(data) {
        console.log('Received initial config:', data);
        // Could initialize UI with config data
    }

    updateConnectionStatus() {
        const statusElement = document.getElementById('connection-status');
        const connectBtn = document.getElementById('connect-rigel');
        const disconnectBtn = document.getElementById('disconnect-rigel');

        if (statusElement) {
            statusElement.textContent = this.isConnected ? 'Connected' : 'Disconnected';
            statusElement.className = this.isConnected ? 'status-connected' : 'status-disconnected';
        }

        if (connectBtn) connectBtn.disabled = this.isConnected;
        if (disconnectBtn) disconnectBtn.disabled = !this.isConnected;
    }

    handleTelemetry(data) {
        // Handle single telemetry object or array of telemetry
        const telemetryArray = Array.isArray(data) ? data : [data];
        
        telemetryArray.forEach(telemetry => {
            this.telemetryData[telemetry.sensor_id] = telemetry;
            this.updateTelemetryDisplay(telemetry);
            
            // Check thresholds and generate alerts if needed
            this.checkThresholds(telemetry);
        });
    }

    handleAlert(alert) {
        this.alertsHistory.unshift(alert);
        this.saveAlertsHistory();
        this.updateAlertsDisplay();
        toastSystem.show(alert.message, alert.severity);
    }

    updateTelemetryDisplay(data) {
        const element = document.getElementById(`telemetry-${data.sensor_id}`);
        const card = document.getElementById(`telemetry-${data.sensor_id}`)?.parentElement;
        
        if (element) {
            element.textContent = data.value.toFixed(2);
            element.className = `telemetry-value ${this.getStatusClass(data)}`;
        }
        
        if (card) {
            card.className = `telemetry-card ${this.getStatusClass(data)}`;
        }
    }

    updateAlertsDisplay() {
        const historyElement = document.getElementById('alerts-history');
        if (historyElement) {
            historyElement.innerHTML = this.alertsHistory
                .slice(0, 10)
                .map(alert => `
                    <div class="alert-item ${alert.severity}">
                        <div class="alert-header">
                            <span class="alert-severity">${alert.severity.toUpperCase()}</span>
                            <span class="alert-time">${new Date(alert.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div class="alert-message">${alert.message}</div>
                        <div class="alert-system">System: ${alert.system}</div>
                    </div>
                `).join('');
        }
    }

    getStatusClass(data) {
        // Define thresholds based on sensor type
        const thresholds = {
            'o2_pct': { warning: { min: 19.5 }, critical: { min: 18.0 } },
            'co2_ppm': { warning: { max: 1000 }, critical: { max: 5000 } },
            'radiation': { warning: { max: 50 }, critical: { max: 500 } },
            'strain': { warning: { max: 0.002 }, critical: { max: 0.005 } },
            'temperature': { warning: { max: 26 }, critical: { max: 28 } },
            'pressure': { warning: { min: 97 }, critical: { min: 95 } }
        };

        const type = data.type;
        const value = data.value;
        const threshold = thresholds[type];

        if (!threshold) return 'status-normal';

        if (threshold.critical) {
            if ((threshold.critical.min !== undefined && value <= threshold.critical.min) ||
                (threshold.critical.max !== undefined && value >= threshold.critical.max)) {
                return 'status-critical';
            }
        }

        if (threshold.warning) {
            if ((threshold.warning.min !== undefined && value <= threshold.warning.min) ||
                (threshold.warning.max !== undefined && value >= threshold.warning.max)) {
                return 'status-warning';
            }
        }

        return 'status-normal';
    }

    checkThresholds(data) {
        const status = this.getStatusClass(data);
        if (status !== 'status-normal') {
            // Check if we already have a recent alert for this sensor
            const recentAlert = this.alertsHistory.find(alert => 
                alert.sensor_refs.includes(data.sensor_id) && 
                alert.severity === status.replace('status-', '') &&
                Date.now() - new Date(alert.timestamp).getTime() < 30000 // 30 seconds
            );

            if (!recentAlert) {
                this.handleAlert({
                    alert_id: 'auto-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                    severity: status.replace('status-', ''),
                    system: data.category,
                    sensor_refs: [data.sensor_id],
                    message: `${data.type} ${status.replace('status-', '')}: ${data.value.toFixed(2)} ${data.unit} at ${data.location}`,
                    timestamp: new Date().toISOString(),
                    actions: ['monitor', 'notify_crew']
                });
            }
        }
    }

    generateTelemetry() {
        const sensors = [
            { id: 'o2-01', type: 'o2_pct', category: 'life_support', unit: '%', min: 17.5, max: 21.0 },
            { id: 'co2-01', type: 'co2_ppm', category: 'life_support', unit: 'ppm', min: 400, max: 6000 },
            { id: 'rad-01', type: 'radiation', category: 'radiation', unit: 'μSv/h', min: 5, max: 600 },
            { id: 'strain-01', type: 'strain', category: 'structural', unit: 'strain', min: 0.001, max: 0.006 },
            { id: 'temp-01', type: 'temperature', category: 'thermal', unit: '°C', min: 18, max: 28 },
            { id: 'pressure-01', type: 'pressure', category: 'life_support', unit: 'kPa', min: 95, max: 105 }
        ];

        const sensor = sensors[Math.floor(Math.random() * sensors.length)];
        
        // Add some realistic variation with occasional spikes
        let value;
        if (Math.random() < 0.05) { // 5% chance for anomaly
            value = sensor.min + Math.random() * (sensor.max - sensor.min) * 0.3;
        } else {
            // Normal operation with small variations
            const baseValue = (sensor.min + sensor.max) / 2;
            const variation = (Math.random() - 0.5) * (sensor.max - sensor.min) * 0.1;
            value = baseValue + variation;
        }

        // Ensure value stays within bounds
        value = Math.max(sensor.min, Math.min(sensor.max, value));

        return {
            sensor_id: sensor.id,
            category: sensor.category,
            type: sensor.type,
            value: parseFloat(value.toFixed(3)),
            unit: sensor.unit,
            timestamp: new Date().toISOString(),
            location: 'hab_A'
        };
    }

    generateAlert() {
        const systems = ['life_support', 'radiation', 'structural', 'thermal'];
        const severities = ['warning', 'critical'];
        const messages = {
            life_support: [
                'O2 levels dropping below optimal range',
                'CO2 levels elevated above threshold',
                'Cabin pressure fluctuation detected',
                'Air quality degradation detected'
            ],
            radiation: [
                'Radiation spike detected from solar activity',
                'Solar flare warning - increased radiation levels',
                'Radiation levels above safe threshold',
                'Cosmic ray shower detected'
            ],
            structural: [
                'Structural stress detected in module A',
                'Vibration anomaly in life support systems',
                'Strain gauge reading above normal limits',
                'Micro-meteoroid impact detected on outer hull'
            ],
            thermal: [
                'Temperature regulation system performance degraded',
                'Heat load increasing beyond cooling capacity',
                'Radiator efficiency below optimal levels',
                'Thermal control system requires maintenance'
            ]
        };

        const system = systems[Math.floor(Math.random() * systems.length)];
        const severity = severities[Math.floor(Math.random() * severities.length)];
        const message = messages[system][Math.floor(Math.random() * messages[system].length)];

        return {
            alert_id: 'alert-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            severity: severity,
            system: system,
            sensor_refs: [`${system.split('_')[0]}-01`],
            message: message,
            timestamp: new Date().toISOString(),
            actions: ['monitor', 'notify_crew']
        };
    }

    saveAlertsHistory() {
        try {
            localStorage.setItem('rigelAlerts', JSON.stringify(this.alertsHistory.slice(0, 50)));
        } catch (e) {
            console.warn('Could not save alerts to localStorage:', e);
        }
    }

    loadAlertsHistory() {
        try {
            const saved = localStorage.getItem('rigelAlerts');
            if (saved) {
                this.alertsHistory = JSON.parse(saved);
                this.updateAlertsDisplay();
            }
        } catch (e) {
            console.warn('Could not load alerts from localStorage:', e);
        }
    }
}

// Utility function for hero button
function scrollToContent() {
    const problemSection = document.querySelector('.problem-definition');
    if (problemSection) {
        problemSection.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// Initialize Rigel Demo when on rigel.html
if (window.location.pathname.includes('rigel.html') || window.location.href.includes('rigel.html')) {
    document.addEventListener('DOMContentLoaded', () => {
        // Add slight delay to ensure DOM is fully loaded
        setTimeout(() => {
            window.rigelDemo = new RigelDemo();
        }, 100);
    });
}

// Add loading state to improve UX
document.addEventListener('DOMContentLoaded', function() {
    // Remove loading class if exists
    document.body.classList.remove('loading');
    
    // Add loaded class for any post-load animations
    setTimeout(() => {
        document.body.classList.add('loaded');
    }, 100);
});

// Error boundary for any script errors
window.addEventListener('error', function(e) {
    console.error('Script error:', e.error);
    // You could show a user-friendly error message here
});

console.log('Habitect website loaded successfully');