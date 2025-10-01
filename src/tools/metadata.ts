import { MonoApi } from "../runtime/api";
import { MonoImage } from "../model/image";

export interface MonoMetadataTable {
  pointer: NativePointer;
  rows: number;
  getRow(index: number): NativePointer;
}

export function getMetadataTable(api: MonoApi, image: MonoImage, tableId: number): MonoMetadataTable {
  if (!api.hasExport("mono_image_get_table_info")) {
    throw new Error("mono_image_get_table_info export not available on this Mono runtime");
  }
  const tableInfo = api.call("mono_image_get_table_info", image.pointer, tableId);
  const rows = api.call<number>("mono_table_info_get_rows", tableInfo);
  return {
    pointer: tableInfo,
    rows,
    getRow(index: number): NativePointer {
      if (index < 0 || index >= rows) {
        throw new RangeError(`metadata row index ${index} out of bounds (0..${rows - 1})`);
      }
      return api.call("mono_table_info_get", tableInfo, index);
    },
  };
}
