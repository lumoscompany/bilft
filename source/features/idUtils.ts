import { launchParams } from "./telegramIntegration";

export const addPrefix = (id: string) => (id.startsWith("id") ? id : `id${id}`);
export const removePrefix = (id: string) =>
  id.startsWith("id") ? id.slice(2) : id;

export function getProfileId() {
  const searchParams = new URLSearchParams(window.location.search);
  const searchParamsID = searchParams.get("id");
  if (searchParamsID) {
    return addPrefix(searchParamsID);
  }

  {
    const startParamId = launchParams.initData?.startParam;
    if (startParamId) {
      return startParamId;
    }
  }

  return addPrefix(getSelfUserId());
}
/**
 *
 * @returns Profile id without prefix aka board id
 */
export const getProfileIdWithoutPrefix = () => removePrefix(getProfileId());

export const isEqualIds = (a: string, b: string) => {
  const aStrip = a.slice(a.startsWith("id") ? 2 : 0);
  const bStrip = b.slice(b.startsWith("id") ? 2 : 0);

  return aStrip === bStrip;
};

export const getSelfUserId = () => {
  const id = launchParams.initData?.user?.id;
  if (!id) {
    throw new Error("Invalid user");
  }
  return id.toString();
};
