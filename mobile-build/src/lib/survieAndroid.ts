import { Linking, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Protection du suivi contre les « tueurs de batterie » des constructeurs
 * (Xiaomi, Tecno, Infinix, Huawei, Samsung...). Android n'offre aucune API pour
 * LIRE ces réglages : on ouvre le bon écran système, puis l'agent confirme.
 */
export const PACKAGE_ANDROID = 'com.trackingpdv.mobile';
const CLE_BATTERIE = 'protection_batterie_ok';
const CLE_DEMARRAGE = 'protection_demarrage_ok';

export const estAndroid = Platform.OS === 'android';

export const fabricant = (): string =>
  String((Platform.constants as any)?.Manufacturer || (Platform.constants as any)?.Brand || '').toLowerCase();

/** Constructeurs qui exigent en plus d'autoriser le « démarrage automatique ». */
export const necessiteDemarrageAuto = (): boolean =>
  /xiaomi|redmi|poco|tecno|infinix|itel|transsion|huawei|honor|oppo|realme|oneplus|vivo/.test(fabricant());

type Intent = { action: string; params?: Record<string, unknown> };

async function lancerPremierIntentValide(intents: Intent[]): Promise<boolean> {
  const IntentLauncher = require('expo-intent-launcher');
  for (const it of intents) {
    try {
      await IntentLauncher.startActivityAsync(it.action, it.params);
      return true;
    } catch {
      /* essai suivant */
    }
  }
  return false;
}

const detailsApp: Intent = {
  action: 'android.settings.APPLICATION_DETAILS_SETTINGS',
  params: { data: `package:${PACKAGE_ANDROID}` },
};

/** Demande « Ne pas optimiser la batterie » pour l'app. */
export async function demanderDerogationBatterie(): Promise<void> {
  if (!estAndroid) return;
  const ok = await lancerPremierIntentValide([
    { action: 'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS', params: { data: `package:${PACKAGE_ANDROID}` } },
    { action: 'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS' },
    detailsApp,
  ]);
  if (!ok) await Linking.openSettings();
}

const comp = (pkg: string, cls: string): Intent => ({ action: 'android.intent.action.MAIN', params: { packageName: pkg, className: cls } });

/** Ouvre l'écran « démarrage automatique » propre à la marque, sinon les réglages de l'app. */
export async function ouvrirDemarrageAuto(): Promise<void> {
  if (!estAndroid) return;
  const f = fabricant();
  let intents: Intent[] = [];
  if (/xiaomi|redmi|poco/.test(f)) intents = [comp('com.miui.securitycenter', 'com.miui.permcenter.autostart.AutoStartManagementActivity')];
  else if (/tecno|infinix|itel|transsion/.test(f)) intents = [comp('com.transsion.phonemaster', 'com.itel.autostart.AutoStartActivity'), comp('com.transsion.phonemaster', 'com.cyin.himgr.autostart.AutoStartActivity')];
  else if (/huawei|honor/.test(f)) intents = [comp('com.huawei.systemmanager', 'com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity'), comp('com.huawei.systemmanager', 'com.huawei.systemmanager.optimize.process.ProtectActivity')];
  else if (/oppo|realme|oneplus/.test(f)) intents = [comp('com.coloros.safecenter', 'com.coloros.safecenter.permission.startup.StartupAppListActivity')];
  else if (/vivo/.test(f)) intents = [comp('com.vivo.permissionmanager', 'com.vivo.permissionmanager.activity.BgStartUpManagerActivity')];
  const ok = await lancerPremierIntentValide([...intents, detailsApp]);
  if (!ok) await Linking.openSettings();
}

export async function lireProtection(): Promise<{ batterie: boolean; demarrage: boolean }> {
  const [b, d] = await Promise.all([SecureStore.getItemAsync(CLE_BATTERIE), SecureStore.getItemAsync(CLE_DEMARRAGE)]);
  return { batterie: b === '1', demarrage: d === '1' || !necessiteDemarrageAuto() };
}
export const confirmerBatterie = () => SecureStore.setItemAsync(CLE_BATTERIE, '1');
export const confirmerDemarrage = () => SecureStore.setItemAsync(CLE_DEMARRAGE, '1');
