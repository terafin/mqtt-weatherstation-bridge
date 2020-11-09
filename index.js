// Requirements
const mqtt = require('mqtt')
const _ = require('lodash')
const interval = require('interval-promise')
const logging = require('homeautomation-js-lib/logging.js')
const got = require('got')
const mqtt_helpers = require('homeautomation-js-lib/mqtt_helpers.js')
const utilities = require('homeautomation-js-lib/utilities.js')

// Config
const topic_prefix = process.env.TOPIC_PREFIX
const weatherstationIP = process.env.WEATHERLINK_IP

// Setup MQTT
const client = mqtt_helpers.setupClient(null, null)

if (_.isNil(topic_prefix)) {
    logging.warn('TOPIC_PREFIX not set, not starting')
    process.abort()
}

if (_.isNil(weatherstationIP)) {
    logging.warn('WEATHERLINK_IP not set, not starting')
    process.abort()
}

var mqttOptions = {}

var shouldRetain = process.env.MQTT_RETAIN

if (_.isNil(shouldRetain)) {
    shouldRetain = true
}

if (!_.isNil(shouldRetain)) {
    mqttOptions['retain'] = shouldRetain
}

async function query_station(station) {
    const url = 'http://' + station + ':80/v1/current_conditions'
    logging.info('davis weatherlink request url: ' + url)
    var error = null
    var body = null
    var results = null

    try {
        const response = await got.get(url)
        results = JSON.parse(response.body).data
    } catch (e) {
        logging.error('failed querying station: ' + e)
        error = e
    }

    return results
}

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

const values_to_convert_to_c = ['wind_chill', 'temp', 'temp_in', 'dew_point', 'wet_bulb', 'heat_index', 'thw_index', 'thw_index', 'thsw_index']

async function check_measurements() {
    const results = await query_station(weatherstationIP)

    logging.debug('results: ' + JSON.stringify(results))

    const deviceID = results.did
    const timestamp = results.ts

    client.smartPublish(mqtt_helpers.generateTopic(topic_prefix, 'device_id'), deviceID, mqttOptions)
    client.smartPublish(mqtt_helpers.generateTopic(topic_prefix, 'timestamp'), timestamp, mqttOptions)

    results.conditions.forEach(condition_set => {
        client.smartPublishCollection(topic_prefix, condition_set, ['data_structure_type', 'lsid', 'txid'], mqttOptions)
        Object.keys(condition_set).forEach(key => {
            if (values_to_convert_to_c.includes(key)) {
                value = condition_set[key]
                if (!_.isNil(value)) {
                    const celsius = ((value - 32) * 5 / 9).toFixed(1)
                    client.smartPublish(mqtt_helpers.generateTopic(topic_prefix, key + '_c'), celsius, mqttOptions)
                }

            }
        })
    })
}

const startMonitoring = function() {
    logging.info('Starting to monitor: ' + weatherstationIP)
    interval(async() => {
        check_measurements()
    }, 10 * 1000)
    check_measurements()
}

startMonitoring()