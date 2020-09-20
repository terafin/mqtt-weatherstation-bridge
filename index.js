// Requirements
const mqtt = require('mqtt')
const _ = require('lodash')
const interval = require('interval-promise')
const logging = require('homeautomation-js-lib/logging.js')
const Davis = require('davis-weather')
const mqtt_helpers = require('homeautomation-js-lib/mqtt_helpers.js')
const utilities = require('homeautomation-js-lib/utilities.js')

// Config
const topic_prefix = process.env.TOPIC_PREFIX
const weatherstationIP = process.env.DAVIS_IP
var weatherstationPort = process.env.DAVIS_PORT

// Setup MQTT
const client = mqtt_helpers.setupClient(null, null)

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

const average_options = {
    values_for_running_average: 8,
    min_values_for_running_average_threshold: 3,
    threshold_to_throw_away: 50,
    max_values_to_throw_away: 2
}

const slow_moving_average_options = {
    values_for_running_average: 10,
    min_values_for_running_average_threshold: 3,
    threshold_to_throw_away: 10,
    max_values_to_throw_away: 3
}

const values_to_use_slow_running_average = ['outsideTemperature', 'outsideHumidity', 'insideHumidity', 'insideTemperature']
const values_to_use_running_average = ['barometer']

const check_measurements = function() {
    davisClient.getCurrentConditions(function(err, data) {
        if (err) {
            logging.info(err)
        } else {
            Object.keys(data).forEach(measurement => {
                const value = data[measurement]
                if (isNaN(value)) {
                    client.smartPublish(mqtt_helpers.generateTopic(topic_prefix, measurement), value)
                } else if (values_to_use_slow_running_average.includes(measurement)) {
                    utilities.add_running_average(measurement, value, slow_moving_average_options)
                    client.smartPublish(mqtt_helpers.generateTopic(topic_prefix, measurement), utilities.running_average(measurement))
                } else if (values_to_use_running_average.includes(measurement)) {
                    utilities.add_running_average(measurement, value, average_options)
                    client.smartPublish(mqtt_helpers.generateTopic(topic_prefix, measurement), utilities.running_average(measurement))
                } else {
                    client.smartPublish(mqtt_helpers.generateTopic(topic_prefix, measurement), value)
                }
            })
        }
    })
}

const startMonitoring = function() {
    logging.info('Starting to monitor: ' + weatherstationIP)
    interval(async() => {
        check_measurements()
    }, 5 * 1000)
    check_measurements()
}

startMonitoring()