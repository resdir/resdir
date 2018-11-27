import React from 'react';
import PropTypes from 'prop-types';
import RadiumStarter, {Button} from 'radium-starter';
import isEqual from 'lodash/isEqual';

const OK_BUTTON_TITLE = 'OK';
const CANCEL_BUTTON_TITLE = 'Cancel';

export class Modal {
  constructor({okButtonTitle = OK_BUTTON_TITLE, cancelButtonTitle = CANCEL_BUTTON_TITLE} = {}) {
    this.okButtonTitle = okButtonTitle;
    this.cancelButtonTitle = cancelButtonTitle;
    this._stack = [];
  }

  getOKButtonTitle() {
    const title = this.okButtonTitle;
    return typeof title === 'function' ? title() : title;
  }

  getCancelButtonTitle() {
    const title = this.cancelButtonTitle;
    return typeof title === 'function' ? title() : title;
  }

  createElement() {
    return <ModalComponent modal={this} />;
  }

  open(attributes = {}) {
    return new Promise(resolve => {
      attributes = {
        ...attributes,
        _onClose: value => {
          this.close();
          resolve(value);
        }
      };
      this._stack.push(attributes);
      this.emitChange();

      document.activeElement.blur();
    });
  }

  close() {
    this._stack.pop();
    this.emitChange();
  }

  getIsVisible() {
    return this._stack.length > 0;
  }

  getAttributes() {
    return this._stack[this._stack.length - 1] || {};
  }

  async dialog(attributes = {}) {
    return await this.open(attributes);
  }

  async dialogAlert(attributes = {}, options = {}) {
    const okButton = {
      title: this.getOKButtonTitle(),
      value: true,
      default: true
    };
    Object.assign(okButton, options.okButton);

    return await this.dialog({
      title: options.title,
      buttons: [okButton],
      ...attributes
    });
  }

  async alert(message, options = {}) {
    return await this.dialogAlert({message}, options);
  }

  async dialogConfirm(attributes = {}, options = {}) {
    const okButton = {
      title: this.getOKButtonTitle(),
      value: true,
      default: true
    };
    Object.assign(okButton, options.okButton);

    const cancelButton = {
      title: this.getCancelButtonTitle(),
      value: false
    };
    Object.assign(cancelButton, options.cancelButton);

    return await this.dialog({
      title: options.title,
      buttons: [okButton, cancelButton],
      ...attributes
    });
  }

  async confirm(message, options = {}) {
    return await this.dialogConfirm({message}, options);
  }

  registerChangeListener(listener) {
    this._changeListener = listener;
  }

  unregisterChangeListener() {
    this._changeListener = undefined;
  }

  emitChange() {
    if (!this._changeListener) {
      throw new Error("Modal hasn't any registered listeners");
    }
    this._changeListener();
  }
}

class ModalComponent extends React.Component {
  static propTypes = {
    modal: PropTypes.object.isRequired
  };

  delayedStyle = {
    opacity: 0
  };

  componentDidMount() {
    this.props.modal.registerChangeListener(() => {
      this.forceUpdate();
    });
  }

  componentWillUnmount() {
    this.props.modal.unregisterChangeListener();
  }

  render() {
    return (
      <RadiumStarter>
        {(t, s) => {
          const {modal} = this.props;

          const attrs = modal.getAttributes();

          const modalStyle = [
            s.showIf(modal.getIsVisible()),
            {
              opacity: this.delayedStyle.opacity,
              transition: 'opacity .1s ease-in'
            }
          ];

          const overlayStyle = {
            position: 'fixed',
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            zIndex: 20000,
            backgroundColor: t.overlayBackgroundColor,
            opacity: 0.66
          };

          const wrapperStyle =
            attrs.position === 'center' ?
              {
                position: 'fixed',
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                zIndex: 20001,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                paddingTop: '1.5rem',
                paddingBottom: '1.5rem'
              } :
              {
                position: 'fixed',
                top: '125px',
                left: 0,
                bottom: 0,
                right: 0,
                zIndex: 20001,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              };

          const dialogStyle = {
            flex: attrs.maxHeight ? '1' : undefined,
            display: 'flex',
            flexDirection: 'column',
            width: attrs.width || '512px',
            minHeight: 0, // https://stackoverflow.com/questions/28636832/firefox-overflow-y-not-working-with-nested-flexbox/28639686#28639686
            maxHeight: attrs.maxHeight || undefined,
            padding: attrs.padding || '1.5rem',
            backgroundColor: t.backgroundColor,
            opacity: 1,
            ...s.border,
            ...s.rounded,
            [`@media (max-width: ${t.smallBreakpoint})`]: {
              width: '300px',
              padding: '1rem'
            }
          };

          const nextStyle = {
            opacity: modal.getIsVisible() ? 1 : 0
          };
          if (!isEqual(nextStyle, this.delayedStyle)) {
            this.delayedStyle = nextStyle;
            setTimeout(() => this.forceUpdate(), 50);
          }

          const children = [];

          if (attrs.title) {
            children.push(
              <h3
                key="title"
                style={[
                  s.regular,
                  s.secondaryTextColor,
                  s.minimumLineHeight,
                  {marginTop: '-0.25rem', marginBottom: '1.5rem'}
                ]}
              >
                {attrs.title}
              </h3>
            );
          }

          if (attrs.message) {
            let element;
            if (Object.prototype.hasOwnProperty.call(attrs.message, '__html')) {
              element = <div key="message" dangerouslySetInnerHTML={attrs.message} />; // eslint-disable-line react/no-danger
            } else {
              element = (
                <div key="message" style={{whiteSpace: 'pre-line'}}>
                  {attrs.message}
                </div>
              );
            }
            children.push(element);
          }

          if (attrs.render) {
            children.push(
              <React.Fragment key="render">
                {attrs.render({close: attrs._onClose})}
              </React.Fragment>
            );
          }

          if (attrs.buttons && attrs.buttons.length) {
            const buttons = [];
            for (let i = 0; i < attrs.buttons.length; i++) {
              const button = attrs.buttons[i];
              const props = {key: i};
              if (button.default) {
                props.rsPrimary = true;
              }
              props.onClick = () => attrs._onClose(button.value);
              if (i > 0) {
                props.style = {marginRight: '.75rem'};
              }
              buttons.push(<Button {...props}>{button.title}</Button>);
            }
            children.push(
              <div
                key="buttons"
                style={{
                  display: 'flex',
                  flexDirection: 'row-reverse',
                  marginTop: '1.5rem'
                }}
              >
                {buttons}
              </div>
            );
          }

          return (
            <div style={modalStyle}>
              <div style={overlayStyle} />
              <div style={wrapperStyle}>
                <div style={dialogStyle}>{children}</div>
              </div>
            </div>
          );
        }}
      </RadiumStarter>
    );
  }
}

export default Modal;
