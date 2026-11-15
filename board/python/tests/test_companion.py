"""Validate settings transport through the MCU's latest-message mailbox."""
import sys
from pathlib import Path
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import display

class CompanionTransportTests(unittest.TestCase):
    def test_settings_are_in_every_screen_payload_and_do_not_change_stats_positions(self):
        with patch.object(display, 'HAVE_BRIDGE', False):
            screen = display.Display(lambda action: None)
        screen.companion({'name': 'Bean|!\n', 'color': 'blue', 'glasses': False})
        screen.stats({'status': 'running', 'current': 'phone', 'elapsedMs': 12000, 'focusPct': 80})
        fields = screen.last.split('|')
        self.assertEqual(fields[0:5], ['S', 'running', 'phone', '12', '80'])
        self.assertEqual(fields[7:], ['Bean/!', 'blue', '0'])
        screen.setup(True, 'Ready', '172.20.10.4:8765')
        self.assertEqual(screen.last.split('|')[4:], ['Bean/!', 'blue', '0'])
    def test_invalid_palettes_and_empty_names_fall_back(self):
        with patch.object(display, 'HAVE_BRIDGE', False):
            screen = display.Display(lambda action: None)
        screen.companion({'name': '  ', 'color': 'oops'})
        screen.setup(False, '', '')
        self.assertTrue(screen.last.endswith('|Moss|green|1'))
        screen.companion(None)
        self.assertEqual(screen.companion_fields, 'Moss|green|1')

if __name__ == '__main__': unittest.main()
