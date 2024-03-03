import Info from '../structures/Info';

import InformationHandler from '../handlers/informationHandler.js';
import SmartAlarmHandler from '../handlers/smartAlarmHandler.js';
import SmartSwitchHandler from '../handlers/smartSwitchHandler.js';
import StorageMonitorHandler from '../handlers/storageMonitorHandler.js';
import TeamHandler from '../handlers/teamHandler.js';
import TimeHandler from '../handlers/timeHandler.js';
import VendingMachines from '../handlers/vendingMachineHandler.js';
import MapMarkers from '../structures/MapMarkers.js';
import Team from '../structures/Team';
import Time from '../structures/Time';

export default {
    pollingHandler: async function (rustplus, client) {
        /* Poll information such as info, mapMarkers, teamInfo and time */
        const info = await rustplus.getInfoAsync();
        if (!(await rustplus.isResponseValid(info))) return;
        const mapMarkers = await rustplus.getMapMarkersAsync();
        if (!(await rustplus.isResponseValid(mapMarkers))) return;
        const teamInfo = await rustplus.getTeamInfoAsync();
        if (!(await rustplus.isResponseValid(teamInfo))) return;
        const time = await rustplus.getTimeAsync();
        if (!(await rustplus.isResponseValid(time))) return;

        if (rustplus.isFirstPoll) {
            rustplus.info = new Info(info.info);
            rustplus.time = new Time(time.time, rustplus, client);
            rustplus.team = new Team(teamInfo.teamInfo, rustplus);
            rustplus.mapMarkers = new MapMarkers(mapMarkers.mapMarkers, rustplus, client);
        }

        await module.exports.handlers(rustplus, client, info, mapMarkers, teamInfo, time);
        rustplus.isFirstPoll = false;
    },

    handlers: async function (rustplus, client, info, mapMarkers, teamInfo, time) {
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
    },
};
