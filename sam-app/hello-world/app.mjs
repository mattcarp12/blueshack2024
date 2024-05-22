/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html 
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 * 
 */
import cbor from 'cbor';
import IotApi from '@arduino/arduino-iot-client';
import rp from 'request-promise';

const thingId = "a0c6f7f6-43f8-4644-a8f6-34e8f6551fbf"
const arduinoDeviceId = "26fe4fbb-6203-4f1d-8350-6ac66fab16ef"
const bluesDeviceId = "dev:89153172025c"

const notehubClientId = "e48b59c8-375f-45c4-a90f-6c02f503329a"
const notehubClientSecret = "b6527569461d8fbc70e0b7999843a9b47016238a6b1ce96c007cd3f57aba6548"

const arduinoClientId = "ReFvAw96Qpb7SFId5I8M63raYu5KazzI"
const arduinoClientSecret = "4B3JjzjsfPzAhmBHrgLQvExZ75e6ufQe6EDxxInff7Byns9Fq9pE5TwhGiMDkrx9"

async function getToken() {
  var options = {
      method: 'POST',
      url: 'https://api2.arduino.cc/iot/v1/clients/token',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      json: true,
      form: {
          grant_type: 'client_credentials',
          client_id: arduinoClientId,
          client_secret: arduinoClientSecret,
          audience: 'https://api2.arduino.cc/iot'
      }
  };

  try {
      const response = await rp(options);
      return response['access_token'];
  }
  catch (error) {
      console.error("Failed getting an access token: " + error)
  }
}

async function getNotehubToken() {
  var options = {
    method: 'POST',
    url: 'https://notehub.io/oauth2/token',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    json: true,
    form: {
        grant_type: 'client_credentials',
        client_id: notehubClientId,
        client_secret: notehubClientSecret,
    }
  };

  try {
      const response = await rp(options);
      return response['access_token'];
  }
  catch (error) {
      console.error("Failed getting an access token: " + error)
  }  
}

async function updateNotehub(payload) {
  const token = await getNotehubToken();
  var options = {
    method: 'POST',
    url: 'https://api.notefile.net',
    headers: { 'Authorization': 'Bearer ' + token },
    json: true,
    body: payload
  };

  try {
      const response = await rp(options);
      console.log("Notehub response: ", response);
      return response;
  }
  catch (error) {
      console.error("Failed to update Notehub: " + error)
  }  
}

async function updateThingProperty(propertyId, value) {
  var client = IotApi.ApiClient.instance;
  // Configure OAuth2 access token for authorization: oauth2
  var oauth2 = client.authentications['oauth2'];
  oauth2.accessToken = await getToken();

  const api = new IotApi.PropertiesV2Api(client);

  const id = thingId;
  const propertyValue = {
      "device_id": arduinoDeviceId,
      "value": value,
  };

  console.log("updateThingProperty: ", id, propertyId, propertyValue);

  const response =  await api.propertiesV2Publish(id, propertyId, propertyValue);
  console.log("Arduino response: " + JSON.stringify(response));
  return response
}

export const lambdaHandler = async (event, context) => {

  const ledPropertyId = "a84ac561-ff9f-4c8f-897c-5a49852c6d7d";
  const secondsPropertyId = "75209c6e-2a61-49c3-959c-b4f7df3bd8eb";
  const potentiometerPropertyId = "15751f0a-ea62-4ea1-a115-b717c7fce46b";

  console.log("Event: " + JSON.stringify(event));
  const body = JSON.parse(event.body);

  if(body.webhook_id) {
    console.log("Arduino request", body.values, typeof body.values);
    const values_obj = JSON.parse(body.values.replace(/'/g, '"').replace(/True/g,'true').replace(/False/g,'false'));
    for(var i=0; i< values_obj.length; i++) {
      if(values_obj[i].name === "led") {
        const ledUpdatedValue = values_obj[i].value;
        if(ledUpdatedValue) {
          await updateNotehub({"req":"note.add","device":bluesDeviceId,"product":"com.blues.arduino","file":"arduino_iot_cloud.qis","payload":"gaIAAQT1","allow":true});
          console.log("Sending payload: gaIAAQT1");
          // led is on
        } else {
          await updateNotehub({"req":"note.add","device":bluesDeviceId,"product":"com.blues.arduino","file":"arduino_iot_cloud.qis","payload":"gaIAAQT0","allow":true})
          console.log("Sending payload: gaIAAQT0");
          // led is off
        }
      }
    }
  } else {
    const payload = body.payload

    const buffer = Buffer.from(payload, 'base64');
    const bufString = buffer.toString('hex');
  
    const cborBuffer = Buffer.from(bufString, 'hex');
  
    const dataMap = cbor.decodeFirstSync(cborBuffer);
    console.log(dataMap);
  
    for(const item in dataMap) {
        let sensorName = "";
        let sensorValue;
        let propertyId = "";
    
        for (let [key, value] of dataMap[item]) {
          if(key === 0) {
            // setting up fieldName
            if(value === 1) {
              sensorName = "led";
              propertyId = ledPropertyId;
            } else if(value === 2) {
              sensorName = "potentiometer";
              propertyId = potentiometerPropertyId;
            } else if(value === 3) {
              sensorName = "seconds"
              propertyId = secondsPropertyId;
            }
          } else if(key === 4) {
            if(value) {
              sensorValue = true;
            } else {
              sensorValue = false;
            }
          } else if(key === 2) {
            sensorValue = value;
          } else if(key === 3) {
      
          }
        }
      
        console.log("Data: " + sensorName + " " + sensorValue);
        console.log("Calling updateThingProperty: ", propertyId, sensorValue);
        await updateThingProperty(propertyId, sensorValue);
      }
  }
  const response = {
    statusCode: 200,
    body: ""
  };

  return response;
};
  