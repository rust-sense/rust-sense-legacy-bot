import Info from '../structures/Info.js';
import * as InformationHandler from '../handlers/informationHandler.js';
import MapMarkers from '../structures/MapMarkers.js';
import * as SmartAlarmHandler from '../handlers/smartAlarmHandler.js';
import * as SmartSwitchHandler from '../handlers/smartSwitchHandler.js';
import * as StorageMonitorHandler from '../handlers/storageMonitorHandler.js';
import Team from '../structures/Team.js';
import * as TeamHandler from '../handlers/teamHandler.js';
import Time from '../structures/Time.js';
import * as TimeHandler from '../handlers/timeHandler.js';
import * as VendingMachines from '../handlers/vendingMachineHandler.js';

export async function pollingHandler(rustplus: any, client: any) {
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

        await handlers(rustplus, client, info, mapMarkers, teamInfo, time);
        rustplus.isFirstPoll = false;
    } finally {
        rustplus._pollingInProgress = false;
    }
}

export async function handlers(rustplus: any, client: any, info: any, mapMarkers: any, teamInfo: any, time: any) {
    await TeamHandler.handler(rustplus, client, teamInfo.teamInfo);
    rustplus.team.updateTeam(teamInfo.teamInfo);

    await SmartSwitchHandler.handler(rustplus, client, time.time);
    TimeHandler.handler(rustplus, client, time.time);
    await VendingMachines.handler(rustplus, client, mapMarkers.mapMarkers);

    rustplus.time.updateTime(time.time);
    rustplus.info.updateInfo(info.info);
    rustplus.mapMarkers.updateMapMarkers(mapMarkers.mapMarkers);

    await InformationHandler.handler(rustplus);
    await StorageMonitorHandler.handler(rustplus, client);
    await SmartAlarmHandler.handler(rustplus, client);
}