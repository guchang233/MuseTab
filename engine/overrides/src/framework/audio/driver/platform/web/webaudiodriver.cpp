/*
 * SPDX-License-Identifier: GPL-3.0-only
 * MuseScore-CLA-applies
 *
 * MuseScore
 * Music Composition & Notation
 *
 * Copyright (C) 2025 MuseScore Limited and others
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
// Modified for MuseTab: trimmed to the MuseScore 4.7.4 IAudioDriver interface.
#include "webaudiodriver.h"

#include <emscripten/val.h>

#include "log.h"

using namespace muse;
using namespace muse::audio;

static const AudioDeviceID DEFAULT_DEVICE_ID("default");

void WebAudioDriver::init()
{
}

std::string WebAudioDriver::name() const
{
    return "web";
}

AudioDeviceID WebAudioDriver::defaultDevice() const
{
    return DEFAULT_DEVICE_ID;
}

bool WebAudioDriver::open(const Spec& spec, Spec* activeSpec)
{
    LOGI() << "try open driver";

    emscripten::val::module_property("driver")["open"]();

    emscripten::val specVal = emscripten::val::module_property("driver")["outputSpec"]();
    m_activeSpec = spec;
    m_activeSpec.output.sampleRate = specVal["sampleRate"].as<double>();
    m_activeSpec.output.samplesPerChannel = specVal["samplesPerChannel"].as<int>();
    m_activeSpecChanged.send(m_activeSpec);

    LOGI() << "activeSpec: "
           << "sampleRate: " << m_activeSpec.output.sampleRate
           << ", samplesPerChannel: " << m_activeSpec.output.samplesPerChannel
           << ", audioChannelCount: " << m_activeSpec.output.audioChannelCount
           << " (real: " << specVal["audioChannelCount"].as<int>() << ")";

    if (activeSpec) {
        *activeSpec = m_activeSpec;
    }

    m_opened = true;
    return true;
}

void WebAudioDriver::resume()
{
    emscripten::val::module_property("driver")["resume"]();
}

void WebAudioDriver::suspend()
{
    emscripten::val::module_property("driver")["suspend"]();
}

void WebAudioDriver::close()
{
    m_opened = false;
    emscripten::val::module_property("driver")["close"]();
}

bool WebAudioDriver::isOpened() const
{
    return m_opened;
}

const WebAudioDriver::Spec& WebAudioDriver::activeSpec() const
{
    return m_activeSpec;
}

async::Channel<WebAudioDriver::Spec> WebAudioDriver::activeSpecChanged() const
{
    return m_activeSpecChanged;
}

std::vector<samples_t> WebAudioDriver::availableOutputDeviceBufferSizes() const
{
    return { static_cast<samples_t>(m_activeSpec.output.samplesPerChannel) };
}

std::vector<sample_rate_t> WebAudioDriver::availableOutputDeviceSampleRates() const
{
    return { static_cast<sample_rate_t>(m_activeSpec.output.sampleRate) };
}

AudioDeviceList WebAudioDriver::availableOutputDevices() const
{
    AudioDevice d;
    d.id = DEFAULT_DEVICE_ID;
    d.name = DEFAULT_DEVICE_ID;
    return { d };
}

async::Notification WebAudioDriver::availableOutputDevicesChanged() const
{
    return m_availableOutputDevicesChanged;
}
