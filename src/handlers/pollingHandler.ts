// @ts-nocheck
const Info = require('../structures/Info');
const InformationHandler = require('../handlers/informationHandler');
const MapMarkers = require('../structures/MapMarkers');
const SmartAlarmHandler = require('../handlers/smartAlarmHandler');
const SmartSwitchHandler = require('../handlers/smartSwitchHandler');
const StorageMonitorHandler = require('../handlers/storageMonitorHandler');
const Team = require('../structures/Team');
const TeamHandler = require('../handlers/teamHandler');
const Time = require('../structures/Time');
const TimeHandler = require('../handlers/timeHandler');
const VendingMachines = require('../handlers/vendingMachineHandler');

module.exports = {
    pollingHandler: async function (rustplus, client) {
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

            await module.exports.handlers(rustplus, client, info, mapMarkers, teamInfo, time);
            rustplus.isFirstPoll = false;
        } finally {
            rustplus._pollingInProgress = false;
        }
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
