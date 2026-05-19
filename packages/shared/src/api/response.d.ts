export type ApiResponse<T> = {
    success: true;
    data: T;
} | {
    success: false;
    error: string;
    code?: string;
};
export declare const ok: <T>(data: T) => ApiResponse<T>;
export declare const fail: (error: string, code?: string) => ApiResponse<never>;
//# sourceMappingURL=response.d.ts.map