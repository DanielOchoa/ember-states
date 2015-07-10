import Ember from 'ember';

var get = Ember.get, set = Ember.set;

/**
@module ember
@submodule ember-states
*/

/**
  The State class allows you to define individual states within a finite state machine
  inside your Ember application.

  ### How States Work

  When you setup a finite state machine this means you are setting up a mechanism to precisely
  manage the change within a system. You can control the various states or modes that your
  application can be in at any given time. Additionally, you can manage what specific states
  are allowed to transition to other states.

  The state machine is in only one state at a time. This state is known as the current state.
  It is possible to change from one state to another by a triggering event or condition.
  This is called a transition.

  Finite state machines are important because they allow the application developer to be
  deterministic about the the sequence of events that can happen within a system. Some states
  cannot be entered when the application is a given state.

  For example:

  A door that is in the `locked` state cannot be `opened` (you must transition to the `unlocked`
  state first).

  A door that is in the `open` state cannot be `locked` (you must transition to the `closed`
  state first).


  Each state instance has the following characteristics:

  - Zero or more parent states
  - A start state
  - A name
  - A path (a computed value that prefixes parent states and the complete hierarchy to itself )

  A state is known as a "leafState" when it is the last item on the path and has no children
  beneath it.

  The isLeaf property returns a boolean.

  Each state can emit the following transition events

  - setup
  - enter
  - exit

  A state object is ususally created in the context of a state manager.

  ```javascript
  doorStateManager = StateManager.create({
    locked: State.create(),
    closed: State.create(),
    unlocked: State.create(),
    open: State.create()
  });
  ```

  @class State
  @namespace Ember
  @extends Ember.Object
  @uses Ember.Evented
*/
var State = Ember.Object.extend(Ember.Evented,
/** @scope State.prototype */{
  /**
    A reference to the parent state.

    @property parentState
    @type State
  */
  parentState: null,

  /**
    The name of this state.

    @property name
    @type String
  */
  name: null,

  /**
    The full path to this state.

    @property path
    @type String
  */
  path: Ember.computed(function() {
    var parentPath = get(this, 'parentState.path'),
        path = get(this, 'name');

    if (parentPath) {
      path = parentPath + '.' + path;
    }

    return path;
  }),

  /**
    @private

    Override the default event firing from `Ember.Evented` to
    also call methods with the given name.

    @method trigger
    @param name
  */
  trigger(name) {
    if (this[name]) {
      this[name].apply(this, [].slice.call(arguments, 1));
    }
    this._super.apply(this, arguments);
  },

  /**
    Initialize State object
    Sets childStates to Ember.NativeArray
    Sets eventTransitions to empty object unless already defined.
    Loops over properties of this state and ensures that any property that
    is an instance of State is moved to `states` hash.


    @method init
  */
  init() {
    var states = get(this, 'states');
    set(this, 'childStates', Ember.A());
    set(this, 'eventTransitions', get(this, 'eventTransitions') || {});

    var name, value, transitionTarget;

    // As a convenience, loop over the properties
    // of this state and look for any that are other
    // State instances or classes, and move them
    // to the `states` hash. This avoids having to
    // create an explicit separate hash.

    if (!states) {
      states = {};

      for (name in this) {
        if (name === "constructor") { continue; }

        if (value = this[name]) {
          if (transitionTarget = value.transitionTarget) {
            this.eventTransitions[name] = transitionTarget;
          }

          this.setupChild(states, name, value);
        }
      }

      set(this, 'states', states);
    } else {
      for (name in states) {
        this.setupChild(states, name, states[name]);
      }
    }

    // pathsCaches is a nested hash of the form:
    //   pathsCaches[stateManagerTypeGuid][path] == transitions_hash
    set(this, 'pathsCaches', {});
  },

  /**
    Sets a cached instance of the state. Ember.guidFor is used
    to find the guid of the associated state manager. If a cache can be found
    the state path is added to that cache, otherwise an empty JavaScript object
    is created. And the state path is appended to that instead.

    @method setPathsCache
    @param stateManager
    @param path
    @param transitions
  */
  setPathsCache(stateManager, path, transitions) {
    let stateManagerTypeGuid = Ember.guidFor(stateManager.constructor);
    let pathsCaches = get(this, 'pathsCaches');
    let pathsCacheForManager = pathsCaches[stateManagerTypeGuid] || {};

    pathsCacheForManager[path] = transitions;
    pathsCaches[stateManagerTypeGuid] = pathsCacheForManager;
  },

  /**
    Returns a cached path for the state instance. Each state manager
    has a GUID and this is used to look up a cached path if it has already
    been created. If a cached path is not found an empty JavaScript object
    is returned instead.

    @method getPathsCache
    @param stateManager
    @param path
  */
  getPathsCache(stateManager, path) {
    let stateManagerTypeGuid = Ember.guidFor(stateManager.constructor);
    let pathsCaches = this.get('pathsCaches');
    let pathsCacheForManager = pathsCaches[stateManagerTypeGuid] || {};

    return pathsCacheForManager[path];
  },

  /**
    @private

    Create the child instance and ensure that it is an instance of State

    @method setupChild
    @param states
    @param name
    @param value
  */
  setupChild(states, name, value) {
    if (!value) { return false; }
    let instance;

    if (value instanceof State) {
      set(value, 'name', name);
      instance = value;
      instance.container = this.container;
    } else if (State.detect(value)) {
      instance = value.create({
        name: name,
        container: this.container
      });
    }

    if (instance instanceof State) {
      set(instance, 'parentState', this);
      get(this, 'childStates').pushObject(instance);
      states[name] = instance;
      return instance;
    }
  },

  /**
    @private

    @method lookupEventTransition
    @param name
  */
  lookupEventTransition(name) {
    var path, state = this;

    while(state && !path) {
      path = state.eventTransitions[name];
      state = state.get('parentState');
    }

    return path;
  },

  /**
    A Boolean value indicating whether the state is a leaf state
    in the state hierarchy. This is `false` if the state has child
    states; otherwise it is true.

    @property isLeaf
    @type Boolean
  */
  isLeaf: Ember.computed(function() {
    return !this.get('childStates').length;
  }),

  /**
    This is the default transition event.

    @event setup
    @param {StateManager} manager
    @param context
    @see StateManager#transitionEvent
  */

  /**
    This event fires when the state is entered.

    @event enter
    @param {StateManager} manager
  */

  /**
    This event fires when the state is exited.

    @event exit
    @param {StateManager} manager
  */
});

State.reopenClass({

  /**
    Creates an action function for transitioning to the named state while
    preserving context.

    The following example StateManagers are equivalent:

    ```javascript
    aManager = StateManager.create({
      stateOne: State.create({
        changeToStateTwo: State.transitionTo('stateTwo')
      }),
      stateTwo: State.create({})
    })

    bManager = StateManager.create({
      stateOne: State.create({
        changeToStateTwo: function(manager, context) {
          manager.transitionTo('stateTwo', context)
        }
      }),
      stateTwo: State.create({})
    })
    ```

    @method transitionTo
    @static
    @param {String} target
  */
  transitionTo(target) {

    var transitionFunction = function(stateManager, contextOrEvent) {
      var contexts = [],
          Event = Ember.$ && Ember.$.Event;

      if (contextOrEvent && (Event && contextOrEvent instanceof Event)) {
        if (contextOrEvent.hasOwnProperty('contexts')) {
          contexts = contextOrEvent.contexts.slice();
        }
      }
      else {
        contexts = [].slice.call(arguments, 1);
      }

      contexts.unshift(target);
      stateManager.transitionTo.apply(stateManager, contexts);
    };

    transitionFunction.transitionTarget = target;

    return transitionFunction;
  }

});

export default State;
