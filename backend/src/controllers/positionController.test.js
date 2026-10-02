jest.mock('../models', () => ({
  Position: { create: jest.fn(), findOne: jest.fn(), findAll: jest.fn(), bulkCreate: jest.fn() },
  PDV: { findByPk: jest.fn(), update: jest.fn() },
}));
jest.mock('../services/geofencingService', () => ({ checkAll: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../sockets/socketHandler', () => ({ getIo: jest.fn() }));

const { Position, PDV } = require('../models');
const geofencingService = require('../services/geofencingService');
const { getIo } = require('../sockets/socketHandler');
const controller = require('./positionController');

const createResponse = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

describe('mobileCreatePosition', () => {
  let io;

  beforeEach(() => {
    jest.clearAllMocks();
    io = { emit: jest.fn() };
    io.to = jest.fn(() => ({ emit: io.emit }));
    getIo.mockReturnValue(io);
    PDV.findByPk.mockResolvedValue({ id: 12, commercial_id: 12 });
    PDV.update.mockResolvedValue([1]);
    geofencingService.checkAll.mockResolvedValue(undefined);
  });

  it('rejects invalid coordinates before writing', async () => {
    const res = createResponse();

    await controller.mobileCreatePosition(
      { body: { pdv_id: 12, latitude: 95, longitude: 2 } },
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Position.create).not.toHaveBeenCalled();
    expect(io.to).not.toHaveBeenCalled();
  });

  it('returns an existing position for a retried event without rebroadcasting', async () => {
    const existing = { id: 99, pdv_id: 12, client_event_id: 'terminal-evt-1' };
    Position.create.mockRejectedValue({ name: 'SequelizeUniqueConstraintError' });
    Position.findOne.mockResolvedValue(existing);
    const res = createResponse();

    await controller.mobileCreatePosition(
      { body: { client_event_id: 'terminal-evt-1', pdv_id: 12, latitude: 5, longitude: -4 } },
      res
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(existing);
    expect(PDV.update).not.toHaveBeenCalled();
    expect(io.to).not.toHaveBeenCalled();
  });

  it('does not reveal a duplicate event belonging to a different PDV', async () => {
    Position.create.mockRejectedValue({ name: 'SequelizeUniqueConstraintError' });
    Position.findOne.mockResolvedValue({ id: 98, pdv_id: 77, client_event_id: 'reused-event-id' });
    const res = createResponse();

    await controller.mobileCreatePosition(
      { body: { client_event_id: 'reused-event-id', pdv_id: 12, latitude: 5, longitude: -4 } },
      res
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Identifiant de position déjà utilisé' });
    expect(io.to).not.toHaveBeenCalled();
  });

  it('stores a valid point and broadcasts the measured accuracy', async () => {
    const position = {
      id: 100,
      pdv_id: 12,
      latitude: 5.3,
      longitude: -4,
      precision: 8.5,
      horodatage: new Date(),
    };
    Position.create.mockResolvedValue(position);
    const res = createResponse();

    await controller.mobileCreatePosition(
      {
        body: {
          client_event_id: 'terminal-evt-2',
          pdv_id: 12,
          latitude: 5.3,
          longitude: -4,
          precision: 8.5,
          horodatage: position.horodatage.toISOString(),
        },
      },
      res
    );

    expect(Position.create).toHaveBeenCalledWith(expect.objectContaining({ precision: 8.5 }));
    expect(io.to).toHaveBeenCalledWith(['role-admin', 'user-12']);
    expect(io.emit).toHaveBeenCalledWith('position_update', expect.objectContaining({ precision: 8.5 }));
    expect(geofencingService.checkAll).toHaveBeenCalledWith(12, 5.3, -4);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('keeps old offline points in history without moving the live location backward', async () => {
    const position = {
      id: 101,
      pdv_id: 12,
      latitude: 5.1,
      longitude: -3.9,
      precision: null,
      horodatage: new Date('2026-01-01T00:00:00.000Z'),
    };
    Position.create.mockResolvedValue(position);
    PDV.update.mockResolvedValue([0]);
    const res = createResponse();

    await controller.mobileCreatePosition(
      {
        body: {
          client_event_id: 'terminal-evt-old',
          pdv_id: 12,
          latitude: 5.1,
          longitude: -3.9,
          horodatage: position.horodatage.toISOString(),
        },
      },
      res
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(geofencingService.checkAll).not.toHaveBeenCalled();
    expect(io.to).not.toHaveBeenCalled();
  });

  it('stores a mobile backlog in one batch and publishes only its latest point', async () => {
    const points = [
      { client_event_id: 'event-1', pdv_id: 12, latitude: 5.1, longitude: -4, precision: 12, horodatage: '2026-10-01T10:00:00.000Z' },
      { client_event_id: 'event-2', pdv_id: 12, latitude: 5.2, longitude: -4, precision: 8, horodatage: '2026-10-01T10:00:30.000Z' },
    ];
    Position.findAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(points.map((point, index) => ({ ...point, id: index + 1 })));
    const res = createResponse();

    await controller.mobileCreatePositionsBatch(
      { mobilePdvId: 12, body: { pdv_id: 12, positions: points } },
      res
    );

    expect(Position.bulkCreate).toHaveBeenCalledTimes(1);
    expect(Position.bulkCreate).toHaveBeenCalledWith(expect.any(Array), { ignoreDuplicates: true });
    expect(PDV.update).toHaveBeenCalledTimes(1);
    expect(geofencingService.checkAll).toHaveBeenCalledTimes(2);
    expect(io.to).toHaveBeenCalledTimes(1);
    expect(io.emit).toHaveBeenCalledWith('position_update', expect.objectContaining({
      latitude: 5.2,
      precision: 8,
    }));
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ accepted: ['event-1', 'event-2'], inserted: 2 });
  });

  it('rejects an oversized batch without writing', async () => {
    const res = createResponse();

    await controller.mobileCreatePositionsBatch(
      { mobilePdvId: 12, body: { pdv_id: 12, positions: Array(26).fill({}) } },
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Position.bulkCreate).not.toHaveBeenCalled();
  });
});