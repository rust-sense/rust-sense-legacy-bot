import type DiscordBot from '../structures/DiscordBot.js';
import Info from '../structures/Info.js';
import MapMarkers from '../structures/MapMarkers.js';
import Team from '../structures/Team.js';
import Time from '../structures/Time.js';
import * as InformationHandler from './informationService.js';
import * as SmartAlarmHandler from './smartAlarmService.js';
import * as SmartSwitchHandler from './smartSwitchService.js';
import * as StorageMonitorHandler from './storageMonitorService.js';
import * as TeamHandler from './teamService.js';
import * as TimeHandler from './timeService.js';
import * as VendingMachines from './vendingMachineService.js';

export async function pollRustPlusState(rustplus: any, client: DiscordBot) {
    if (rustplus._pollingInProgress) return;
    rustplus._pollingInProgress = true;
    try {
        /* Poll information such as info, mapMarkers, teamInfo and time */
        let info = await rustplus.getInfoAsync();
        if (!rustplus.isResponseValid(info)) return;
        let mapMarkers = await rustplus.getMapMarkersAsync();
        if (!rustplus.isResponseValid(mapMarkers)) return;
        let teamInfo = await rustplus.getTeamInfoAsync();
        if (!rustplus.isResponseValid(teamInfo)) return;
        let time = await rustplus.getTimeAsync();
        if (!rustplus.isResponseValid(time)) return;

        if (rustplus.isFirstPoll) {
            rustplus.info = new Info(info.info);
            rustplus.time = new Time(time.time, rustplus, client);
            rustplus.team = new Team(teamInfo.teamInfo, rustplus);
            rustplus.mapMarkers = new MapMarkers(mapMarkers.mapMarkers, rustplus, client);
            rustplus.restorePersistentRuntimeState();
        }

        await processPollResults(rustplus, client, info, mapMarkers, teamInfo, time);
        rustplus.isFirstPoll = false;
    } finally {
        rustplus._pollingInProgress = false;
    }
}

export async function processPollResults(
    rustplus: any,
    client: DiscordBot,
    info: any,
    mapMarkers: any,
    teamInfo: any,
    time: any,
) {
    await TeamHandler.processTeamUpdate(rustplus, client, teamInfo.teamInfo);
    rustplus.team.updateTeam(teamInfo.teamInfo);

    await SmartSwitchHandler.syncSmartSwitches(rustplus, client, time.time);
    TimeHandler.syncRustPlusTime(rustplus, client, time.time);
    await VendingMachines.syncVendingMachines(rustplus, client, mapMarkers.mapMarkers);

    rustplus.time.updateTime(time.time);
    rustplus.info.updateInfo(info.info);
    rustplus.mapMarkers.updateMapMarkers(mapMarkers.mapMarkers);

    await InformationHandler.syncServerInformation(rustplus);
    await StorageMonitorHandler.syncStorageMonitors(rustplus, client);
    await SmartAlarmHandler.syncSmartAlarms(rustplus, client);
}
