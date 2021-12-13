// Requirements
import mqtt from 'mqtt'
import _ from 'lodash'
import interval from 'interval-promise'
import logging from 'homeautomation-js-lib/logging.js'
import got from "got"
import mqtt_helpers from 'homeautomation-js-lib/mqtt_helpers.js'
import PWS from 'wunderground-pws'

// Config
const topic_prefix = process.env.TOPIC_PREFIX
const weatherstationIP = process.env.WEATHERLINK_IP
const stationID = process.env.WUNDERGROUND_STATION_ID
const stationKey = process.env.WUNDERGROUND_STATION_KEY

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


var pws = null

if ( !_.isNil(stationID) && !_.isNil(stationKey) ) {
    logging.info('Will upload to wunderground using stationID: ' + stationID + ' and stationKey: ' + stationKey)
    pws = new PWS(stationID, stationKey)
    // const supportedFields = pws.getFields()
    // logging.info('supported fields: ' + supportedFields)
} else {
    logging.info('No WUNDERGROUND_STATION_ID and/or WUNDERGROUND_STATION_KEY present, not uploading to wunderground')
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

const values_to_convert_to_c = ['wind_chill', 'temp', 'temp_in', 'dew_point', 'wet_bulb', 'heat_index', 'thw_index', 'thw_index', 'thsw_index']

const wunderground_values_to_convert_to_mm_to_inches = []
const wunderground_values_to_convert_to_inches_by_100 = ['rainfall_daily', 'rainfall_last_60_min']



const davisToWundergroundMap = {
    'wind_dir_last': 'winddir',
    'wind_speed_last': 'windspeedmph',
    'wind_speed_avg_last_1_min': 'windgustmph',
    'wind_dir_scalar_avg_last_1_min': 'windgustdir',
    'wind_speed_avg_last_2_min': 'windspdmph_avg2m',
    'wind_dir_scalar_avg_last_2_min': 'winddir_avg2m',
    'wind_speed_hi_last_10_min': 'windgustmph_10m',
    'wind_dir_at_hi_speed_last_10_min': 'windgustdir_10m',
    'hum': 'humidity',
    'dew_point': 'dewptf',
    'temp': 'tempf',
    'rainfall_last_60_min': 'rainin',
    'rainfall_daily': 'dailyrainin',
    'bar_absolute': 'baromin',
    'uv_index': 'uv',
    
    // '': 'weather',
    // '': 'clouds',
    // '': 'soiltempf',
    // '': 'soilmoisture',
    // '': 'leafwetness',
    'solar_rad': 'solarradiation',
    // '': 'visibility',
    'temp_in': 'indoortempf',
    'hum_in': 'indoorhumidity',
    // '': 'AqNO',
    // '': 'AqNO2T',
    // '': 'AqNO2',
    // '': 'AqNO2Y',
    // '': 'AqNOX',
    // '': 'AqNOY',
    // '': 'AqNO3',
    // '': 'AqSO4',
    // '': 'AqSO2',
    // '': 'AqSO2T',
    // '': 'AqCO',
    // '': 'AqCOT',
    // '': 'AqEC',
    // '': 'AqOC',
    // '': 'AqBC',
    // '': 'AqUV',
    // '': 'AqPM2.5',
    // '': 'AqPM10',
    // '': 'AqOZONE',
    // '': 'softwaretype'
}
const mapFieldFromDavidToWunderground = function(davisField) {
    return davisToWundergroundMap[davisField]
}

async function check_measurements() {
    const results = await query_station(weatherstationIP)

    logging.debug('results: ' + JSON.stringify(results))

    const deviceID = results.did
    const timestamp = results.ts

    client.smartPublish(mqtt_helpers.generateTopic(topic_prefix, 'device_id'), deviceID, mqttOptions)
    client.smartPublish(mqtt_helpers.generateTopic(topic_prefix, 'timestamp'), timestamp, mqttOptions)

    var wundergroundObserversions = {}
    results.conditions.forEach(condition_set => {

        client.smartPublishCollection(topic_prefix, condition_set, ['data_structure_type', 'lsid', 'txid'], mqttOptions)
        Object.keys(condition_set).forEach(key => {
            const wundergroundField = mapFieldFromDavidToWunderground(key)
            if ( !_.isNil(wundergroundField) ) {
                var wundergroundValue = condition_set[key]

                if (!_.isNil(wundergroundValue)) {
                    if (wunderground_values_to_convert_to_mm_to_inches.includes(key)) {
                        wundergroundValue = (wundergroundValue * 0.0394).toFixed(2)
                    } else if (wunderground_values_to_convert_to_inches_by_100.includes(key)) {
                        wundergroundValue = (wundergroundValue / 100.0).toFixed(2)
                    }
                }

                wundergroundObserversions[wundergroundField] = wundergroundValue
            }

            if (values_to_convert_to_c.includes(key)) {
                value = condition_set[key]
                if (!_.isNil(value)) {
                    const celsius = ((value - 32) * 5 / 9).toFixed(1)
                    client.smartPublish(mqtt_helpers.generateTopic(topic_prefix, key + '_c'), celsius, mqttOptions)
                }

            }
        })
    })

    if ( !_.isNil(pws) ) {
        logging.info('Uploading wunderground observerations: ' + JSON.stringify(wundergroundObserversions))
        pws.setObservations(wundergroundObserversions);
        pws.sendObservations(function(error, success){
            if ( !_.isNil(error) ) {
                logging.error('Failed uploaded to wunderground: ' + error)
                
            } else {
                logging.debug('Uploaded to wunderground: ' + success)
            }
        })
    }
}

const startMonitoring = function() {
    logging.info('Starting to monitor: ' + weatherstationIP)
    interval(async() => {
        check_measurements()
    }, 10 * 1000)
    check_measurements()
}

startMonitoring()