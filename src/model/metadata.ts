import { MonoApi } from "../runtime/api.js";
import { MonoErrorCodes, raise } from "../utils/errors.js";
import { MonoImage } from "./image.js";

/**
 * Metadata table accessor interface.
 * Provides access to raw Mono metadata table rows.
 */
export interface MonoMetadataTable {
  /** Pointer to the underlying table info */
  pointer: NativePointer;
  /** Number of rows in the table */
  rows: number;
  /**
   * Get a row by index.
   * @throws {MonoError} if index is out of bounds
   */
  getRow(index: number): NativePointer;
  /**
   * Try to get a row by index without throwing.
   * @returns Row pointer if valid, null otherwise
   */
  tryGetRow(index: number): NativePointer | null;
}

/**
 * Get a metadata table from an image.
 *
 * @param api The MonoApi instance
 * @param image The image to get the table from
 * @param tableId The table ID (e.g., MONO_METADATA_TABLE_TYPEDEF)
 * @returns A metadata table accessor object
 * @throws {MonoError} If the table is not available or index is out of bounds
 *
 * @example
 * ```typescript
 * const typedefTable = getMetadataTable(api, image, MONO_METADATA_TABLE_TYPEDEF);
 * for (let i = 0; i < typedefTable.rows; i++) {
 *   const rowPtr = typedefTable.getRow(i);
 *   // Process row...
 * }
 * ```
 */
export function getMetadataTable(api: MonoApi, image: MonoImage, tableId: number): MonoMetadataTable {
  if (!api.hasExport("mono_image_get_table_info")) {
    raise(
      MonoErrorCodes.NOT_SUPPORTED,
      "mono_image_get_table_info export not available on this Mono runtime",
      "This feature requires a Mono runtime with metadata table support",
    );
  }
  const tableInfo = api.native.mono_image_get_table_info(image.pointer, tableId);
  const rows = api.native.mono_table_info_get_rows(tableInfo) as number;

  return {
    pointer: tableInfo,
    rows,
    getRow(index: number): NativePointer {
      if (index < 0 || index >= rows) {
        raise(
          MonoErrorCodes.INVALID_ARGUMENT,
          `Metadata row index ${index} out of bounds (0..${rows - 1})`,
          "Ensure index is within valid range",
        );
      }
      return api.native.mono_table_info_get(tableInfo, index);
    },

    /**
     * Try to get a row by index without throwing.
     * @param index Row index
     * @returns Row pointer if valid, null otherwise
     */
    tryGetRow(index: number): NativePointer | null {
      if (index < 0 || index >= rows) {
        return null;
      }
      return api.native.mono_table_info_get(tableInfo, index);
    },
  };
}
