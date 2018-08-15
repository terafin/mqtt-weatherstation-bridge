// Requirements
const mqtt = require('mqtt')
const _ = require('lodash')
const repeat = require('repeat')
const logging = require('homeautomation-js-lib/logging.js')
const Davis = require('davis-weather')

require('homeautomation-js-lib/mqtt_helpers.js')

// Config
const topic_prefix = process.env.TOPIC_PREFIX
const weatherstationIP = process.env.DAVIS_IP
var weatherstationPort = process.env.DAVIS_PORT

// Setup MQTT
const client = mqtt.setupClient(null, null)

if (_.isNil(topic_prefix)) {
	logging.warn('TOPIC_PREFIX not set, not starting')
	process.abort()
}

if (_.isNil(weatherstationIP)) {
	logging.warn('DAVIS_IP not set, not starting')
	process.abort()
}

if (_.isNil(weatherstationPort)) {
	weatherstationPort = 22222
}

var mqttOptions = {}

var shouldRetain = process.env.MQTT_RETAIN

if (_.isNil(shouldRetain)) {
	shouldRetain = true
}

if (!_.isNil(shouldRetain)) {
	mqttOptions['retain'] = shouldRetain
}

var davisClient = new Davis(weatherstationIP, weatherstationPort)

const check_measurements = function() {
	davisClient.getCurrentConditions(function(err, data) {    
		if( err ) {
			logging.info(err)
		} else {
			Object.keys(data).forEach(measurement => {
				const value = data[measurement]
				if ( !_.isNil(value) ) { 
					var stringValue = value.toString()

					if ( stringValue != 'NaN' ) { 
						client.smartPublish(topic_prefix + '/' + measurement, stringValue) 
					} 
				} else {
					logging.debug('missing value for key: ' + measurement)
				}
			})
		}
	})
}

const startMonitoring = function() {
	logging.info('Starting to monitor: ' + weatherstationIP)
	repeat(check_measurements).every(30, 's').start.in(1, 'sec')
}

startMonitoring()
