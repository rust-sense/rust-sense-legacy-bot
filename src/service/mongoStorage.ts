import config from '../config';

import { MongoClient, ServerApiVersion } from 'mongodb';

if (!config.mongo.connectionString) {
    throw new Error('MongoDB connection string is not defined');
}

export const client = new MongoClient(config.mongo.connectionString, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

export async function connect() {
    await client.connect();
    await client.db('admin').command({ ping: 1 });
}
