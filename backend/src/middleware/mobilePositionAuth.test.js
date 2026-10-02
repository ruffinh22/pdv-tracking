jest.mock('../models', () => ({ PDV: { findOne: jest.fn() } }));

const jwt = require('jsonwebtoken');
const { PDV } = require('../models');
const middleware = require('./mobilePositionAuth');

const createResponse = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};

describe('mobilePositionAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  it('rejects requests without a terminal token', async () => {
    const res = createResponse();
    const next = jest.fn();

    await middleware({ header: () => null, body: { pdv_id: 8 } }, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects attempts to write positions for a different PDV', async () => {
    const token = jwt.sign({ type: 'mobile-position', pdvId: 8, terminalId: 'terminal-8' }, process.env.JWT_SECRET);
    const res = createResponse();
    const next = jest.fn();

    await middleware(
      { header: () => `Bearer ${token}`, body: { pdv_id: 9 } },
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(PDV.findOne).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts only a token whose terminal is still linked to that PDV', async () => {
    const token = jwt.sign({ type: 'mobile-position', pdvId: 8, terminalId: 'terminal-8' }, process.env.JWT_SECRET);
    const next = jest.fn();
    PDV.findOne.mockResolvedValue({ id: 8 });
    const req = { header: () => `Bearer ${token}`, body: { pdv_id: 8 } };

    await middleware(req, createResponse(), next);

    expect(PDV.findOne).toHaveBeenCalledWith({
      where: { id: 8, id_terminal: 'terminal-8' },
      attributes: ['id'],
    });
    expect(req.mobilePdvId).toBe(8);
    expect(next).toHaveBeenCalledTimes(1);
  });
});