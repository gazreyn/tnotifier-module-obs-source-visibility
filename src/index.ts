import type { PropList, WS } from '@tnotifier/types';
import { PropType } from '@tnotifier/types';
import type { Scene } from 'obs-websocket-js';
//
import css from '@/styles.scss';

export default class extends window.tnotifier.module<{ scene: string, item: string}> {

    ws: WS | null;
    selectedScene: string | null;
    selectedItem: string | null;
    uiIcon: HTMLElement;
    uiLabel: HTMLElement;
    uiModule: HTMLElement;

    constructor() {
        super();

        // Set the Module HTML using the Template file.
        this.$container.appendChild(this.template());

        // Set the CSS from the external file.
        this.css = css;

        /**
         * The OBS WebSocket Instance for the action.
         *
         * @type {WS|null}
         */
         this.ws = null;

         this.selectedScene = null;
         this.selectedItem = null;

        // UI
        this.uiIcon = this.$container.querySelector('#status-icon');
        this.uiLabel = this.$container.querySelector('#label');
        this.uiModule = this.$container;
    }

    async mounted(): Promise<void> {

        const { id } = this.identity;

        try { 
            this.ws = await window.tnotifier.ws(id); 
        } catch(err) {
            throw new Error('Unable to connect to OBS Websocket');
        }

        this.ws.on('SceneItemVisibilityChanged', (res) => { this.handleVisibilityChange(res); });

        await super.mounted();

        this.refresh();

    }

    /**
     * Asynchronously builds all of the properties for this Module.
     *
     * @return {Promise}
     */
     async prepareProps(staged): Promise<PropList> {
        let sceneOptions = {};
        let itemOptions = {};

        const sceneList = await this.getScenes();
        sceneList.forEach((scene) => {
            sceneOptions[scene.name] = { text: scene.name, icon: 'widgets' }
        })

        if(staged.scene) {
            // Scene has been changed/set
            const selectedScene = sceneList.find((scene) => {
                return scene.name === staged.scene;
            });

            selectedScene.sources.forEach((item) => {
                itemOptions[item.name] = { text: item.name, icon: 'widgets' }
            });
            
        }

        return {
            scene: {
                type: PropType.Select,
                required: true,
                default: null,
                label: 'Scene',
                help: 'Select the scene where your source is',
                options: sceneOptions,
                watch: true
            },
            ...(staged.scene ? {
                item: {
                    type: PropType.Select,
                    default: null,
                    required: true,
                    label: 'Item',
                    help: 'Select an item',
                    options: itemOptions,
                },
            } : {}),
        };
    }

    /**
     * Called when the given property has changed.
     *
     * @param {String} key
     * @param {*} value
     * @param {Boolean} initial Whether this is the initial value, `false` if it's an update
     */
    public onPropChange(key: string, value: any, initial: boolean): void {
        switch(key) {
            case 'scene': {
                this.selectedScene = value;
                break;
            }
            case 'item': {
                this.selectedItem = value;
                break;
            }
            default:
                break;
        }

        // If it's an initial value, we won't call refresh as socket connection probably hasn't been made yet
        if (initial) return;

        this.refresh();
    }

    public async getScenes(): Promise<Scene[]> {
        const { scenes } = await this.ws.send('GetSceneList');
        return scenes;
    }

    public handleVisibilityChange(response): void {

        const { sceneName, itemName } = response;

        if (sceneName !== this.selectedScene || itemName !== this.selectedItem) return;

        this.refresh();
    }

    public async refresh(): Promise<void> {
        
        if (!this.selectedScene || !this.selectedItem) {
            return this.updateUI('No Source Selected.');
        }

        // TODO: Wrap this in a try catch, if can't get item visibility, let user know.
        const isVisible = await this.getItemVisibility(this.selectedScene, this.selectedItem);
        this.updateUI(`${this.selectedScene} - ${this.selectedItem}`, isVisible);
    }

    public async getItemVisibility(scene: string, item: string): Promise<boolean> {
        const sourceSettings = await this.ws.send('GetSceneItemProperties', {
            'scene-name': scene,
            'item': item,
        });

        const { visible } = sourceSettings;
        return visible;
    }

    public updateUI(text: string, state: boolean = null): void {
        switch (state) {
            case null:
                this.uiIcon.setAttribute('type', 'obs');
                this.uiModule.className = 'module';
                break;
            case true:
                this.uiIcon.setAttribute('type', 'visibility_on');
                this.uiModule.className = 'module visible';
                break;
            case false:
                this.uiIcon.setAttribute('type', 'visibility_off');
                this.uiModule.className = 'module hidden';
                break;
            default:
                this.uiModule.className = 'module';
                break;
        }
        this.uiLabel.innerText = text;
    }

}
