import constants, { errorCodes } from '../constants';
import transition from '../transition';

var noop = function noop() {};

export default function withNavigation(router) {
    var cancelCurrentTransition = void 0;

    router.navigate = navigate;
    router.navigateToDefault = navigateToDefault;
    router.transitionToState = transitionToState;
    router.cancel = cancel;

    /**
     * Cancel the current transition if there is one
     * @return {Object} The router instance
     */
    function cancel() {
        if (cancelCurrentTransition) {
            cancelCurrentTransition('navigate');
            cancelCurrentTransition = null;
        }

        return router;
    }

    /**
     * Navigate to a route
     * @param  {String}   routeName      The route name
     * @param  {Object}   [routeParams]  The route params
     * @param  {Object}   [options]      The navigation options (`replace`, `reload`)
     * @param  {Function} [done]         A done node style callback (err, state)
     * @return {Function}                A cancel function
     */
    function navigate() {
        var name = arguments.length <= 0 ? undefined : arguments[0];
        var lastArg = arguments.length <= arguments.length - 1 + 0 ? undefined : arguments[arguments.length - 1 + 0];
        var done = typeof lastArg === 'function' ? lastArg : noop;
        var params = babelHelpers.typeof(arguments.length <= 1 ? undefined : arguments[1]) === 'object' ? arguments.length <= 1 ? undefined : arguments[1] : {};
        var opts = babelHelpers.typeof(arguments.length <= 2 ? undefined : arguments[2]) === 'object' ? arguments.length <= 2 ? undefined : arguments[2] : {};

        if (!router.isStarted()) {
            done({ code: errorCodes.ROUTER_NOT_STARTED });
            return;
        }

        var toState = router.buildState(name, params);

        if (!toState) {
            var err = { code: errorCodes.ROUTE_NOT_FOUND };
            done(err);
            router.invokeEventListeners(constants.TRANSITION_ERROR, null, router.getState(), err);
            return;
        }

        toState.path = router.buildPath(name, params);
        var sameStates = router.getState() ? router.areStatesEqual(router.getState(), toState, false) : false;

        // Do not proceed further if states are the same and no reload
        // (no desactivation and no callbacks)
        if (sameStates && !opts.reload) {
            var _err = { code: errorCodes.SAME_STATES };
            done(_err);
            router.invokeEventListeners(constants.TRANSITION_ERROR, toState, router.getState(), _err);
            return;
        }

        var fromState = sameStates ? null : router.getState();

        // Transitio
        return transitionToState(toState, fromState, opts, function (err, state) {
            if (err) {
                if (err.redirect) {
                    var _err$redirect = err.redirect;
                    var _name = _err$redirect.name;
                    var _params = _err$redirect.params;


                    navigate(_name, _params, babelHelpers.extends({}, opts, { reload: true }), done);
                } else {
                    done(err);
                }
            } else {
                router.invokeEventListeners(constants.TRANSITION_SUCCESS, state, fromState, opts);
                done(null, state);
            }
        });
    }

    /**
     * Navigate to the default route (if defined)
     * @param  {Object}   [opts] The navigation options
     * @param  {Function} [done] A done node style callback (err, state)
     * @return {Function}        A cancel function
     */
    function navigateToDefault() {
        var opts = babelHelpers.typeof(arguments.length <= 0 ? undefined : arguments[0]) === 'object' ? arguments.length <= 0 ? undefined : arguments[0] : {};
        var done = arguments.length === 2 ? arguments.length <= 1 ? undefined : arguments[1] : typeof (arguments.length <= 0 ? undefined : arguments[0]) === 'function' ? arguments.length <= 0 ? undefined : arguments[0] : noop;
        var options = router.getOptions();

        if (options.defaultRoute) {
            return navigate(options.defaultRoute, options.defaultParams, opts, done);
        }

        return function () {};
    }

    function transitionToState(toState, fromState) {
        var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];
        var done = arguments.length <= 3 || arguments[3] === undefined ? noop : arguments[3];

        cancel();
        router.invokeEventListeners(constants.TRANSITION_START, toState, fromState);

        cancelCurrentTransition = transition(router, toState, fromState, options, function (err, state) {
            cancelCurrentTransition = null;
            state = state || toState;

            if (err) {
                if (err.code === errorCodes.TRANSITION_CANCELLED) {
                    router.invokeEventListeners(constants.TRANSITION_CANCELLED, toState, fromState);
                } else {
                    router.invokeEventListeners(constants.TRANSITION_ERROR, toState, fromState, err);
                }
                done(err);
            } else {
                router.setState(state);
                done(null, state);
            }
        });

        return cancelCurrentTransition;
    }
}