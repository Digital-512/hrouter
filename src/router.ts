import { compile, Key, pathToRegexp } from "path-to-regexp";

// Type definitions
export interface Parameters {
    [key: string]: string | number;
}
export interface Context {
    params: Parameters;
}
export type Handler = (ctx?: Context, next?: Handler) => void;

export default class {
    private _base: string;
    private _lastPath: string | null;
    private _routes: {
        keys: Key[];
        pattern: RegExp;
        handlers: Handler[];
        base: string;
    }[];

    /**
     * Initializes a new Router instance.
     * @param {string} [base="/"] Initial base path (can be modified by .base())
     * @api public
     */
    constructor(base: string = "/") {
        this._base = base;
        this._lastPath = null;
        this._routes = [];
        this.handleRoutes = this.handleRoutes.bind(this);
    }

    /**
     * Get or set basepath to `path`.
     * @param {string} path Base path
     * @api public
     */
    base(path: string) {
        this._base = path;
    }

    /**
     * Register a new route.
     * @param {string} path Route path
     * @param {Handler[]} handlers Handlers that will be executed on this route
     * @api public
     */
    use(path: string, ...handlers: Handler[]) {
        const keys: Key[] = [];
        const fullPath = this._base === "/" ? path : this._base + path;
        const base = fullPath.split("(.*)")[0];

        // Try to convert route path into RegExp pattern.
        try {
            const pattern = pathToRegexp(fullPath, keys);
            this._routes.push({ keys, pattern, handlers, base });
        } catch (err) {
            // This usually happens if a given route is invalid.
            console.error(`Route '${path}' is invalid.`);
        }

        return this;
    }

    /**
     * Searches within current instance for all pattern pairs that satisfy
     * the current url.
     * Important: Parameters and handlers are assembled/gathered in the order they were defined!
     * This method will always return an Object with `params` and `handlers` keys.
     * The `handlers` and `params` keys will be empty if no matches were found.
     *
     * * Params - Object whose keys are the named parameters of your route pattern.
     * * Handlers - Array containing the ...handlers provided to use().
     *
     * @param {string} url The URL based to match against pattern definitions.
     * @api public
     */
    find(url: string) {
        let params: Parameters = {},
            handlers: Handler[] = [];

        this._routes.forEach((route) => {
            // Check if provided `url` matches current route.
            if (!route.pattern.test(url)) return;

            // Prevent handler re-execution if it has been already executed.
            handlers.push((ctx, next) => {
                if (!ctx || !next) return;

                // Compile route path to URL segment based by user URL
                // and check if the new URL segment has changed.
                const path = compile(route.base)(ctx.params);
                if (this._lastPath !== path) {
                    this._lastPath = path;
                    next();
                }
            });

            // Assign key names to parameters.
            const keys = route.keys.length;
            if (keys) {
                // Get values from URL.
                const matches = route.pattern.exec(url);
                if (matches)
                    for (let i = 0; i < keys; )
                        params[route.keys[i].name] = matches[++i];
            }

            // Include all handlers.
            handlers = handlers.concat(route.handlers);
        });

        return { params, handlers };
    }

    /**
     * This method:
     * 1. Redirects any non-hash routes to hash-based routes.
     * 2. Searches for required routes and returns handlers.
     * 3. Executes first matched route handler with a reference to next handler.
     * @api private
     */
    private handleRoutes() {
        if (location.pathname !== "/") location.href = "/#" + location.pathname;

        const hash = location.hash.replace("#/", "/") || "/";
        const route = this.find(hash);

        if (!route.handlers.length) return;

        let next = 0;
        const handler: Handler = () =>
            route.handlers[next++]({ params: route.params }, handler);
        handler();
    }

    /**
     * Start the router and add event listeners.
     * @api public
     */
    start() {
        this.handleRoutes();
        window.addEventListener("hashchange", this.handleRoutes, false);
    }

    /**
     * Stop the router (removes event listeners).
     * @api public
     */
    stop() {
        window.removeEventListener("hashchange", this.handleRoutes, false);
    }

    /**
     * Redirect to another route.
     * @param {string} path Redirect to this path
     * @api public
     */
    redirect(path: string) {
        location.hash = path;
    }
}
