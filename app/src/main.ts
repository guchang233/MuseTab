import { mount } from 'svelte';
import './ui/fonts.css';
import './ui/tokens.css';
import './ui/base.css';
import './ui/system.css';
import App from './App.svelte';
import './native';

mount(App, { target: document.getElementById('app')! });
document.getElementById('boot-loading')?.remove();
