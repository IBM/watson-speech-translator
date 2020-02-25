# Run locally

This document shows how to run the `watson-speech-translator` application on your local machine.

## Steps

1. [Clone the repo](#clone-the-repo)
1. [Configure credentials](#configure-credentials)
1. [Start the server](#start-the-server)

### Clone the repo

Clone `watson-speech-translator` locally. In a terminal, run:

```bash
git clone https://github.com/IBM/watson-speech-translator
cd watson-speech-translator
```

### Configure credentials

Copy the **env.sample** file to **.env**.

```bash
cp env.sample .env
```

Edit the **.env** file to configure credentials before starting the Node.js server.
The credentials to configure will depend on whether you are provisioning services using IBM Cloud Pak for Data or on IBM Cloud.
 
Click to expand one:

<details><summary><b>IBM Cloud Pak for Data</b></summary>
<p>

For each service (<b>SPEECH_TO_TEXT, LANGUAGE_TRANSLATOR, and TEXT_TO_SPEECH</b>) the following settings are needed with the service name as a prefix:

* Set <b>_AUTH_TYPE</b> to <b>cp4d</b>
* Provide the <b>_URL</b>, <b>_USERNAME</b> and <b>_PASSWORD</b> collected in the previous step.
* For the <b>_AUTH_URL</b> use the base fragment of your URL including the host and port. <i>I.e. https://{cpd_cluster_host}{:port}</i>.
* If your CPD installation is using a self-signed certificate, you need to disable SSL verification with both <b>_AUTH_DISABLE_SSL</b> and <b>_DISABLE_SSL</b>. Disable SSL only if absolutely necessary, and take steps to enable SSL as soon as possible.
* Make sure the examples for IBM Cloud and bearer token auth are commented out (or removed).

```bash
#----------------------------------------------------------
# IBM Cloud Pak for Data (username and password)
#
# If your services are running on IBM Cloud Pak for Data,
# uncomment and configure these.
# Remove or comment out the IBM Cloud section.
#----------------------------------------------------------

SPEECH_TO_TEXT_AUTH_TYPE=cp4d
SPEECH_TO_TEXT_URL=https://{cpd_cluster_host}{:port}/speech-to-text/{release}/instances/{instance_id}/api
SPEECH_TO_TEXT_AUTH_URL=https://{cpd_cluster_host}{:port}
SPEECH_TO_TEXT_USERNAME=<add_speech-to-text_username>
SPEECH_TO_TEXT_PASSWORD=<add_speech-to-text_password>
# If you use a self-signed certificate, you need to disable SSL verification.
# This is not secure and not recommended.
SPEECH_TO_TEXT_DISABLE_SSL=true
SPEECH_TO_TEXT_AUTH_DISABLE_SSL=true

LANGUAGE_TRANSLATOR_AUTH_TYPE=cp4d
LANGUAGE_TRANSLATOR_URL=https://{cpd_cluster_host}{:port}/language-translator/{release}/instances/{instance_id}/api
LANGUAGE_TRANSLATOR_AUTH_URL=https://{cpd_cluster_host}{:port}
LANGUAGE_TRANSLATOR_USERNAME=<add_language-translator_username>
LANGUAGE_TRANSLATOR_PASSWORD=<add_language-translator_password>
# If you use a self-signed certificate, you need to disable SSL verification.
# This is not secure and not recommended.
LANGUAGE_TRANSLATOR_DISABLE_SSL=true
LANGUAGE_TRANSLATOR_AUTH_DISABLE_SSL=true

TEXT_TO_SPEECH_AUTH_TYPE=cp4d
TEXT_TO_SPEECH_URL=https://{cpd_cluster_host}{:port}/text-to-speech/{release}/instances/{instance_id}/api
TEXT_TO_SPEECH_AUTH_URL=https://{cpd_cluster_host}{:port}
TEXT_TO_SPEECH_USERNAME=<add_text-to-speech_username>
TEXT_TO_SPEECH_PASSWORD=<add_text-to-speech_password>
# If you use a self-signed certificate, you need to disable SSL verification.
# This is not secure and not recommended.
TEXT_TO_SPEECH_DISABLE_SSL=true
TEXT_TO_SPEECH_AUTH_DISABLE_SSL=true
```

</p>
</details>

<details><summary><b>IBM Cloud</b></summary>
<p>

<b>For each service (SPEECH_TO_TEXT, LANGUAGE_TRANSLATOR, and TEXT_TO_SPEECH) the following settings are needed with the service name as a prefix:</b>

* Set <b>_AUTH_TYPE</b> to <b>iam</b>
* Provide the <b>_URL</b> and <b>_APIKEY</b> collected in the previous step.
* Make sure the examples for IBM Cloud Pak for Data and bearer token auth are commented out (or removed).
<p>

```bash
#----------------------------------------------------------
# IBM Cloud
#
# If your services are running on IBM Cloud,
# uncomment and configure these.
# Remove or comment out the IBM Cloud Pak for Data sections.
#----------------------------------------------------------

SPEECH_TO_TEXT_AUTH_TYPE=iam
SPEECH_TO_TEXT_APIKEY=<add_speech-to-text_apikey>
SPEECH_TO_TEXT_URL=<add_speech-to-text_url>

LANGUAGE_TRANSLATOR_AUTH_TYPE=iam
LANGUAGE_TRANSLATOR_APIKEY=<add_language-translator_apikey>
LANGUAGE_TRANSLATOR_URL=<add_language-translator_url>

TEXT_TO_SPEECH_AUTH_TYPE=iam
TEXT_TO_SPEECH_APIKEY=<add_text-to-speech_apikey>
TEXT_TO_SPEECH_URL=<add_text-to-speech_url>
```

</p>
</details>


### Start the server

```bash
npm install
npm start
```

The application will be available in your browser at http://localhost:8080.  Return to the README.md for instructions on how to use the app.

[![return](https://raw.githubusercontent.com/IBM/pattern-utils/master/deploy-buttons/return.png)](https://github.com/IBM/watson-speech-translator#use-the-web-app)
