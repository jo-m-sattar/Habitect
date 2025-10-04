const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('.'));

// API health check endpoint
app.get('/api/status', (req, res) => {
    res.json({
        status: 'ok',
        time: new Date().toISOString(),
        version: '1.0.0',
        systems: ['life_support', 'radiation', 'structural', 'thermal']
    });
});

// Telemetry simulation
class TelemetrySimulator {
    constructor() {
        this.sensors = {
            'o2-01': { type: 'o2_pct', category: 'life_support', unit: '%', value: 20.8, min: 19.0, max: 21.0, trend: 0 },
            'co2-01': { type: 'co2_ppm', category: 'life_support', unit: 'ppm', value: 450, min: 400, max: 5000, trend: 0 },
            'rad-01': { type: 'radiation', category: 'radiation', unit: 'μSv/h', value: 12, min: 5, max: 600, trend: 0 },
            'strain-01': { type: 'strain', category: 'structural', unit: 'strain', value: 0.0012, min: 0.001, max: 0.006, trend: 0 },
            'temp-01': { type: 'temperature', category: 'thermal', unit: '°C', value: 22.5, min: 18, max: 28, trend: 0 },
            'pressure-01': { type: 'pressure', category: 'life_support', unit: 'kPa', value: 101.3, min: 95, max: 105, trend: 0 }
        };
        
        this.alerts = [];
        this.connectedClients = new Set();
    }

    generateTelemetry() {
        const telemetry = [];
        
        for (const [sensorId, sensor] of Object.entries(this.sensors)) {
            // Add small random variation
            const variation = (Math.random() - 0.5) * 0.1;
            sensor.value += variation;
            
            // Keep within bounds
            sensor.value = Math.max(sensor.min, Math.min(sensor.max, sensor.value));
            
            // Occasionally create spikes for demo purposes
            if (Math.random() < 0.02) {
                sensor.value = sensor.min + Math.random() * (sensor.max - sensor.min) * 0.5;
            }

            telemetry.push({
                sensor_id: sensorId,
                category: sensor.category,
                type: sensor.type,
                value: parseFloat(sensor.value.toFixed(3)),
                unit: sensor.unit,
                timestamp: new Date().toISOString(),
                location: 'hab_A'
            });
        }

        return telemetry;
    }

    checkThresholds(telemetry) {
        const thresholds = {
            'o2_pct': { warning: 19.5, critical: 18.0 },
            'co2_ppm': { warning: 1000, critical: 5000 },
            'radiation': { warning: 50, critical: 500 },
            'strain': { warning: 0.002, critical: 0.005 },
            'temperature': { warning: 26, critical: 28 },
            'pressure': { warning: 97, critical: 95 }
        };

        const newAlerts = [];

        telemetry.forEach(data => {
            const threshold = thresholds[data.type];
            if (!threshold) return;

            let severity = null;
            if (data.value <= threshold.critical || data.value >= threshold.critical) {
                severity = 'critical';
            } else if (data.value <= threshold.warning || data.value >= threshold.warning) {
                severity = 'warning';
            }

            if (severity) {
                // Check if similar alert already exists
                const existingAlert = this.alerts.find(alert => 
                    alert.sensor_refs.includes(data.sensor_id) && 
                    alert.severity === severity &&
                    Date.now() - new Date(alert.timestamp).getTime() < 30000 // 30 seconds
                );

                if (!existingAlert) {
                    const alert = {
                        alert_id: 'alert-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                        severity: severity,
                        system: data.category,
                        sensor_refs: [data.sensor_id],
                        message: `${data.type} ${severity}: ${data.value} ${data.unit} at ${data.location}`,
                        timestamp: new Date().toISOString(),
                        actions: this.getActions(data.category, severity)
                    };
                    
                    newAlerts.push(alert);
                    this.alerts.unshift(alert);
                    
                    // Keep only last 100 alerts
                    this.alerts = this.alerts.slice(0, 100);
                }
            }
        });

        return newAlerts;
    }

    getActions(system, severity) {
        const actions = {
            life_support: {
                warning: ['increase_ventilation', 'monitor_closely'],
                critical: ['activate_backup_o2', 'notify_crew', 'initiate_emergency_protocol']
            },
            radiation: {
                warning: ['increase_monitoring', 'prepare_shelter'],
                critical: ['activate_shelter', 'notify_crew', 'suspend_evas']
            },
            structural: {
                warning: ['run_diagnostics', 'increase_monitoring'],
                critical: ['isolate_section', 'notify_crew', 'initiate_repair_protocol']
            },
            thermal: {
                warning: ['adjust_cooling', 'monitor_temperatures'],
                critical: ['activate_backup_cooling', 'notify_crew', 'reduce_power_consumption']
            }
        };

        return actions[system]?.[severity] || ['monitor', 'notify_crew'];
    }
}

const simulator = new TelemetrySimulator();

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    simulator.connectedClients.add(socket.id);

    // Send initial configuration
    socket.emit('init', {
        config: {
            thresholds: {
                o2_pct: { warning: 19.5, critical: 18.0 },
                co2_ppm: { warning: 1000, critical: 5000 },
                radiation: { warning: 50, critical: 500 },
                strain: { warning: 0.002, critical: 0.005 }
            },
            systems: ['life_support', 'radiation', 'structural', 'thermal']
        },
        recentAlerts: simulator.alerts.slice(0, 10)
    });

    // Start sending telemetry
    const telemetryInterval = setInterval(() => {
        const telemetry = simulator.generateTelemetry();
        const alerts = simulator.checkThresholds(telemetry);

        socket.emit('telemetry', telemetry);
        
        alerts.forEach(alert => {
            socket.emit('alert', alert);
        });
    }, 2000);

    // Handle client commands
    socket.on('command', (command) => {
        console.log('Received command:', command);
        // Handle various commands from client
        switch (command.type) {
            case 'reset_alert':
                simulator.alerts = simulator.alerts.filter(alert => alert.alert_id !== command.alertId);
                break;
            case 'adjust_threshold':
                // Would adjust thresholds in real implementation
                break;
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        simulator.connectedClients.delete(socket.id);
        clearInterval(telemetryInterval);
    });
});

server.listen(PORT, 'localhost', () => {
    console.log(`Habitect Rigel Demo Server running on http://localhost:${PORT}`);
    console.log('API Status: http://localhost:3000/api/status');
});

module.exports = app;