# mqtt-weatherstation-bridge

This is a simple docker container that I use to bridge to/from my MQTT bridge.

I have a collection of bridges, and the general format of these begins with these environment variables:

```yaml
      TOPIC_PREFIX: /your_topic_prefix  (eg: /some_topic_prefix/somthing)
      MQTT_HOST: YOUR_MQTT_URL (eg: mqtt://mqtt.yourdomain.net)
      (OPTIONAL) MQTT_USER: YOUR_MQTT_USERNAME
      (OPTIONAL) MQTT_PASS: YOUR_MQTT_PASSWORD
```

Here's an example docker compose:

```yaml
version: '3.3'
services:
  mqtt-weatherstation-bridge:
    image: terafin/mqtt-weatherstation-bridge:latest
    environment:
      LOGGING_NAME: mqtt-weatherstation-bridge
      TZ: America/Los_Angeles
      TOPIC_PREFIX: /your_topic_prefix  (eg: /environment/weather)
      WEATHERLINK_IP: YOUR_WEATHERLINK_LIVE_LOCAL_IP
      HEALTH_CHECK_PORT: "3001"
      HEALTH_CHECK_TIME: "120"
      HEALTH_CHECK_URL: /healthcheck
      MQTT_HOST: YOUR_MQTT_URL (eg: mqtt://mqtt.yourdomain.net)
      (OPTIONAL) MQTT_USER: YOUR_MQTT_USERNAME
      (OPTIONAL) MQTT_PASS: YOUR_MQTT_PASSWORD
```

Here's an example publish for my setup:

```log
/environment/weather/timestamp 1604939681
/environment/weather/temp 48
/environment/weather/hum 48.6
/environment/weather/dew_point 29.5
/environment/weather/wet_bulb 37.8
/environment/weather/heat_index 47
/environment/weather/wind_chill 48
/environment/weather/thw_index 47
/environment/weather/thsw_index 55.4
/environment/weather/wind_speed_last 0
/environment/weather/wind_dir_last 0
/environment/weather/wind_speed_avg_last_1_min 0
/environment/weather/wind_dir_scalar_avg_last_1_min 0
/environment/weather/wind_speed_avg_last_2_min 0
/environment/weather/wind_dir_scalar_avg_last_2_min 0
/environment/weather/wind_speed_hi_last_2_min 0
/environment/weather/wind_dir_at_hi_speed_last_2_min 0
/environment/weather/wind_speed_avg_last_10_min 0
/environment/weather/wind_dir_scalar_avg_last_10_min 0
/environment/weather/wind_speed_hi_last_10_min 0
/environment/weather/wind_dir_at_hi_speed_last_10_min 0
/environment/weather/rain_size 1
/environment/weather/rain_rate_last 0
/environment/weather/rain_rate_hi 0
/environment/weather/rainfall_last_15_min 0
/environment/weather/rain_rate_hi_last_15_min 0
/environment/weather/rainfall_last_60_min 0
/environment/weather/rainfall_last_24_hr 0
/environment/weather/solar_rad 311
/environment/weather/uv_index 0.6
/environment/weather/rx_state 0
/environment/weather/trans_battery_flag 0
/environment/weather/rainfall_daily 0
/environment/weather/rainfall_monthly 0
/environment/weather/rainfall_year 0
/environment/weather/temp_in 59.9
/environment/weather/hum_in 39.5
/environment/weather/dew_point_in 35.2
/environment/weather/heat_index_in 56.9
/environment/weather/bar_sea_level 30.176
/environment/weather/bar_trend 0.086
/environment/weather/bar_absolute 29.984
```
