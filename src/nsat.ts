// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import {commands, ExtensionContext, Uri, window} from 'vscode';
import {EventNames} from './constants';
import {TelemetryWorker} from './telemetry';
import {WorkbenchExtension} from './WorkbenchExtension';
import {VscodeCommands} from './common/Commands';

const NSAT_SURVEY_URL = 'https://aka.ms/vscode-iot-workbench-survey';
const PROBABILITY = 1;
const SESSION_COUNT_THRESHOLD = 2;
const SESSION_COUNT_KEY = 'nsat/sessionCount';
const LAST_SESSION_DATE_KEY = 'nsat/lastSessionDate';
const TAKE_SURVEY_DATE_KEY = 'nsat/takeSurveyDate';
const DONT_SHOW_DATE_KEY = 'nsat/dontShowDate';
const SKIP_VERSION_KEY = 'nsat/skipVersion';
const IS_CANDIDATE_KEY = 'nsat/isCandidate';

export class NSAT {
  static async takeSurvey(context: ExtensionContext) {
    const globalState = context.globalState;
    const skipVersion = globalState.get(SKIP_VERSION_KEY, '');
    if (skipVersion) {
      return;
    }

    const date = new Date().toDateString();
    const lastSessionDate =
        globalState.get(LAST_SESSION_DATE_KEY, new Date(0).toDateString());

    if (date === lastSessionDate) {
      return;
    }

    const sessionCount = globalState.get(SESSION_COUNT_KEY, 0) + 1;
    await globalState.update(LAST_SESSION_DATE_KEY, date);
    await globalState.update(SESSION_COUNT_KEY, sessionCount);

    if (sessionCount < SESSION_COUNT_THRESHOLD) {
      return;
    }

    const isCandidate = globalState.get(IS_CANDIDATE_KEY, false) ||
        Math.random() <= PROBABILITY;

    await globalState.update(IS_CANDIDATE_KEY, isCandidate);

    const telemetryWorker = TelemetryWorker.getInstance(context);
    const telemetryContext = telemetryWorker.createContext();

    const extension = WorkbenchExtension.getExtension(context);
    if (!extension) {
      return;
    }
    const extensionVersion = extension.packageJSON.version || 'unknown';
    if (!isCandidate) {
      await globalState.update(SKIP_VERSION_KEY, extensionVersion);
      return;
    }

    const take = {
      title: 'Take Survey',
      run: async () => {
        telemetryContext.properties.message = 'nsat.survey/takeShortSurvey';
        telemetryWorker.sendEvent(EventNames.nsatsurvery, telemetryContext);
        commands.executeCommand(
            VscodeCommands.VscodeOpen,
            Uri.parse(`${NSAT_SURVEY_URL}?o=${
                encodeURIComponent(process.platform)}&v=${
                encodeURIComponent(extensionVersion)}`));
        await globalState.update(IS_CANDIDATE_KEY, false);
        await globalState.update(SKIP_VERSION_KEY, extensionVersion);
        await globalState.update(TAKE_SURVEY_DATE_KEY, date);
      },
    };
    const remind = {
      title: 'Remind Me Later',
      run: async () => {
        telemetryContext.properties.message = 'nsat.survey/remindMeLater';
        telemetryWorker.sendEvent(EventNames.nsatsurvery, telemetryContext);
        await globalState.update(SESSION_COUNT_KEY, 0);
      },
    };
    const never = {
      title: 'Don\'t Show Again',
      run: async () => {
        telemetryContext.properties.message = 'nsat.survey/dontShowAgain';
        telemetryWorker.sendEvent(EventNames.nsatsurvery, telemetryContext);
        await globalState.update(IS_CANDIDATE_KEY, false);
        await globalState.update(SKIP_VERSION_KEY, extensionVersion);
        await globalState.update(DONT_SHOW_DATE_KEY, date);
      },
    };
    telemetryContext.properties.message = 'nsat.survey/userAsked';
    telemetryWorker.sendEvent(EventNames.nsatsurvery, telemetryContext);
    const button = await window.showInformationMessage(
        'Do you mind taking a quick feedback survey about the Azure IoT Device Workbench Extension for VS Code?',
        take, remind, never);
    await (button || remind).run();
  }
}
