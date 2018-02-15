import Modal from '@resdir/react-modal';

let _modal;
export function getModal() {
  if (!_modal) {
    _modal = new Modal();
  }
  return _modal;
}
