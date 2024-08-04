import { client } from './mongoStorage';

const db = client.db('data');
const coll = db.collection('instances');

export async function find(guildId: string) {
    const query = {
        guildId,
    };

    return await coll.findOne(query);
}

export async function save(guildId: string, instance: object) {
    const query = {
        guildId,
    };

    const update = {
        guildId,
        ...instance,
    };

    const options = {
        upsert: true,
    };

    return await coll.updateOne(query, update, options);
}
