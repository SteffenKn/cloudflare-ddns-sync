#!/usr/bin/env groovy

def cleanup_workspace() {
  cleanWs()
  dir("${env.WORKSPACE}@tmp") {
    deleteDir()
  }
  dir("${env.WORKSPACE}@script") {
    deleteDir()
  }
  dir("${env.WORKSPACE}@script@tmp") {
    deleteDir()
  }
}

def setBuildStatus(String message, String state) {
  step([
      $class: "GitHubCommitStatusSetter",
      reposSource: [$class: "ManuallyEnteredRepositorySource", url: "https://github.com/SteffenKn/Cloudflare-DDNS-Sync"],
      contextSource: [$class: "ManuallyEnteredCommitContextSource", context: "Jenkins"],
      errorHandlers: [[$class: "ChangingBuildStatusErrorHandler", result: "UNSTABLE"]],
      statusResultSource: [ $class: "ConditionalStatusResultSource", results: [[$class: "AnyBuildResult", message: message, state: state]] ]
  ]);
}

pipeline {
  agent any
  tools {
    nodejs "nodejs-lts"
  }
  environment {
    NODE_JS_VERSION = 'nodejs-lts'
  }

  stages {
    stage('Prepare') {
      steps {
        setBuildStatus('Building...', 'PENDING')

        script {
          raw_package_version = sh(script: 'node --print --eval "require(\'./package.json\').version"', returnStdout: true)
          package_version = raw_package_version.trim()
          branch = env.BRANCH_NAME;
          branch_is_master = branch == 'master';

          echo("Package version is '${package_version}'")
          echo("Branch is '${branch}'")
        }

        nodejs(configId: env.NPM_RC_FILE, nodeJSInstallationName: env.NODE_JS_VERSION) {
          sh('node --version')
        }
      }
    }

    stage('Install') {
      steps {
        sh('node --version')

        sh('npm install')
      }
    }

    stage('Lint') {
      steps {
        sh('node --version')

        sh('npm run lint')
      }
    }

    stage('Build') {
      steps {
        sh('node --version')

        sh('npm run build')
      }
    }

    stage('Test') {
      steps {
        sh('node --version')

        withCredentials([string(credentialsId: 'CLOUDFLARE_EMAIL', variable: 'CLOUDFLARE_EMAIL'), string(credentialsId: 'CLOUDFLARE_KEY', variable: 'CLOUDFLARE_KEY'), string(credentialsId: 'CLOUDFLARE_RECORDS', variable: 'CLOUDFLARE_RECORDS')]) {
         sh('npm run test-jenkins -- --email="'+CLOUDFLARE_EMAIL+'" --key="'+CLOUDFLARE_KEY+'" --records="'+CLOUDFLARE_RECORDS+'"')

          junit 'report.xml'
        }
      }
    }

    stage('Publish') {
      when {
        expression {
          branch_is_master
        }
      }
      steps {
        sh('node --version')

        withNPM(npmrcConfig: 'Jenkins-Npmrc') {
          sh('npm publish')
        }
      }
    }

    stage('Cleanup') {
      steps {
        script {
          // this stage just exists, so the cleanup-work that happens in the post-script
          // will show up in its own stage in Blue Ocean
          sh(script: ':', returnStdout: true);
        }
      }
    }
  }

  post {
    always {
      script {
        cleanup_workspace();
      }
    }

    success {
      setBuildStatus('Build succeeded.', 'SUCCESS');
    }

    failure {
      setBuildStatus('Build failed!', 'FAILURE');
    }
  }
}
