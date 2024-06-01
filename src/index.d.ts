interface IconifyPluginOptions {
    sourceSVGDir?: string;
    target?: string;
    prefix?: string;
}
export default function (options?: IconifyPluginOptions): {
    name: string;
    configResolved(config: {
        root: string;
    }): void;
    buildStart(): void;
    configureServer(server: {
        watcher: any;
    }): void;
};
export {};
