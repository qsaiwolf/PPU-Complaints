/**
 * Services Controller
 */
import { getDatabaseAdapter } from '../database/connection.js';

export async function listServices(req, res, next) {
  try {
    const adapter = await getDatabaseAdapter();
    const services = await adapter.getServices();
    res.json({
      success: true,
      data: services
    });
  } catch (error) {
    next(error);
  }
}
