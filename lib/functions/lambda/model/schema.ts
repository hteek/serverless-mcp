export enum EntityKeys {
  Client = 'client',
  Session = 'session',
}

export const schema = {
  format: 'onetable:1.1.0',
  version: '0.0.1',
  indexes: {
    primary: { hash: 'pk', sort: 'sk' },
  },
  models: {
    Client: {
      pk: { type: String, value: `public#${EntityKeys.Client}#\${client_id}` },
      sk: { type: String, value: `public#${EntityKeys.Client}` },
      client_id: {
        type: String,
        required: true,
      },
      client_metadata: {
        type: String,
        required: true,
      },
      initial_request: {
        type: String,
        required: true,
      },
      registration_time: {
        type: Number,
        required: true,
      },
    },
    Session: {
      pk: { type: String, value: `\${tenantId}#${EntityKeys.Session}#\${id}` },
      sk: { type: String, value: `\${tenantId}#${EntityKeys.Session}` },
      id: {
        type: String,
        required: true,
        validate:
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      },
      tennatId: {
        type: String,
        validate:
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      },
    },
  } as const,
  params: {
    timestamps: true,
  },
};
