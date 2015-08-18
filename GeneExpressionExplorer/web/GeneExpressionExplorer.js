// vim: sw=4:ts=4:nu:nospell:
/*
 Copyright 2014 Fred Hutchinson Cancer Research Center

 Licensed under the Apache License, Version 2.0 (the 'License');
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an 'AS IS' BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

Ext.namespace('LABKEY.ext');

LABKEY.ext.GeneExpressionExplorer = Ext.extend( Ext.Panel, {

    constructor : function(config) {

        /////////////////////////////////////
        //            Variables            //
        /////////////////////////////////////

        var
            me              = this,
            maskPlot        = undefined,
            reportSessionId = undefined,
            fieldWidth      = 400,
            labelWidth      = 130
            ;

        var checkBtnPlotStatus = function(){
            cfGenes.doLayout();

            if (    cbResponse.isValid( true ) &&
                    cbCohorts.isValid( true ) &&
                    cbTimePoint.isValid( true ) &&
                    cbGenes.isValid( true ) &&
                    spnrTextSize.isValid( true )
            ){
                btnPlot.setDisabled( false );
            } else {
                btnPlot.setDisabled( true );
            }
        };

        var manageCbGenesState = function(){
            var tempSQL = '',
                tempArray = cbCohorts.getCheckedArray( 'featureSetId' ),
                len = tempArray.length
            ;
            if ( len >= 1 ){
                cbGenes.setDisabled( false );
                tempSQL +=  strngSqlStartGenes +
                            strngSqlWhereGenes +
                            tempArray[0];
                if ( len > 1 ) {
                    for ( var i = 1; i < len; i ++ ){
                        tempSQL +=  strngSqlIntersectGenes +
                                    strngSqlStartGenes +
                                    strngSqlWhereGenes +
                                    tempArray[i];
                    }
                }
            } else {
                cbGenes.clearValue();
                cbGenes.setDisabled( true );
            }
            strGene.setSql( tempSQL );

            checkBtnPlotStatus();
        };

        //Help text
        var response_help  = "The variable to plot against the expression of selected genes. For HAI, the timepoint of peak immunogenicity is selected.";
        var timepoint_help = "The gene-expression time point to plot.";
        var cohort_help    = "The cohorts with subjects of interest. Some cohorts might only be available at specific timepoints.";
        var normalize_help = "Should the data be normalized to baseline (i.e. subtract the day 0 response after log transformation), or simply plot the un-normalized data.";
        var genes_help     = "The genes to plot.";
        var textsize_help  = "The size of all text elements on the plot (Including axis, legend and labels)";
        var facet_help     = "The plot will facet by cohorts on the y axis and genes on the x axis. In `grid` mode, the scales are consistent for a gene and for a cohort. In `wrap` mode, the scales are free.<br> Use wrap if you observe empty spaces in the plots. `wrap` is also more appropriate when plotting many genes and a single cohort.";
        var shape_help     = "The shape of the data points.";
        var color_help     = "The color of the data points. (Age is selected by default)";
        var size_help      = "The size of the data points.";
        var alpha_help     = "The transparency of the data points.";


        ///////////////////////////////////
        //            Stores             //
        ///////////////////////////////////

        var strCohort = new LABKEY.ext.Store({
            autoLoad: false,
            listeners: {
                load: function(){
                    if ( this.getCount() > 0 ){
                        cbCohorts.setDisabled( false );
                    } else {
                        cbCohorts.setDisabled( true );
                    }
                },
                loadexception: LABKEY.ext.ISCore.onFailure
            },
            queryName: 'studyCohortsInfo_GEE',
            schemaName: 'study'
        });

        var strTimePoint = new LABKEY.ext.Store({
            autoLoad: true,
            listeners: {
                load: function(){
                    if ( this.getCount() > 0 ){
                        cbTimePoint.setDisabled( false );

                        var num, unit,
                            field = new Ext.data.Field({ name: 'displayTimepoint' });
                        this.recordType.prototype.fields.replace(field);
                        this.each( function(r){
                            if ( r.data[field.name] == undefined ){
                                num                 = r.data['timepoint'];
                                unit                = r.data['timepointUnit'];
                                r.data[field.name]  = num + ' ' + ( num != 1 ? unit : unit.slice( 0, unit.length - 1 ) );
                            }
                        });

                        cbTimePoint.bindStore( this );
                    }
                },
                loadexception: LABKEY.ext.ISCore.onFailure
            },
            queryName: 'timepoints_GEE',
            schemaName: 'study'
        });

        var strngSqlStartGenes      =   'SELECT' +
                                        ' DISTINCT GeneSymbol as gene_symbol' +
                                        ' FROM featureannotation',
            strngSqlWhereGenes      =   ' WHERE featureannotationsetid = ',
            strngSqlIntersectGenes  =   ' INTERSECT '
        ; 

        var strGene = new LABKEY.ext.Store({
            listeners: {
                loadexception: LABKEY.ext.ISCore.onFailure
            },
            schemaName: 'Microarray',
            sql: strngSqlStartGenes
        });

        var strDemographics = new Ext.data.ArrayStore({
            data: [
                [ 'Age', 'Age' ],
                [ 'Gender', 'Gender' ],
                [ 'Race', 'Race' ]
            ],
            fields: [ 'name', 'name' ]
        });

        var strShape = new Ext.data.ArrayStore({
            data: [
                [ 'Gender', 'Gender' ],
                [ 'Race', 'Race' ]
            ],
            fields: [ 'name', 'name' ]
        });


        /////////////////////////////////////
        //      Session instanciation      //
        /////////////////////////////////////

        LABKEY.Report.getSessions({
            success: function( responseObj ){
                var i, array = responseObj.reportSessions, length = array.length;
                for ( i = 0; i < length; i ++ ){
                    if ( array[i].clientContext == 'GeneExpressionExplorer' ){
                        reportSessionId = array[i].reportSessionId;
                        i = length;
                    }
                }
                if ( i == length ){
                    LABKEY.Report.createSession({
                        clientContext : 'GeneExpressionExplorer',
                        failure: LABKEY.ext.ISCore.onFailure,
                        success: function(data){
                            reportSessionId = data.reportSessionId;
                        }
                    });
                }
            }
        });


        /////////////////////////////////////
        //     ComboBoxes / TextFields     //
        /////////////////////////////////////

        var cbResponse = new Ext.ux.form.ExtendedComboBox({
            allowBlank: false,
            displayField: 'name',
            fieldLabel: 'Response',
            lazyInit: false,
            listeners: {
                change:     checkBtnPlotStatus,
                cleared:    checkBtnPlotStatus,
                select:     checkBtnPlotStatus
            },
            store: new Ext.data.ArrayStore({
                data: [ [ 'HAI', 'HAI' ] ],
                fields: [ 'name', 'name' ]
            }),
            value: 'HAI',
            valueField: 'name',
            width: fieldWidth
        });

        var cbCohorts = new Ext.ux.form.ExtendedLovCombo({
            allowBlank: false,
            displayField: 'cohort',
            fieldLabel: 'Cohorts',
            lazyInit: false,
            disabled: true,
            listeners: {
                change:     manageCbGenesState,
                cleared:    manageCbGenesState,
                select:     manageCbGenesState
            },
            separator: ';',
            store: strCohort,
            valueField: 'cohort',
            width: fieldWidth
        });

        var cbTimePoint = new Ext.ux.form.ExtendedComboBox({
            allowBlank: false,
            disabled: true,
            displayField: 'displayTimepoint',
            fieldLabel: 'Time point',
            lazyInit: false,
            listeners: {
                change: function(){
                    handleTimepointSelection();
                },
                cleared: function(){
                    handleTimepointSelection();
                },
                select: function(){
                    handleTimepointSelection();
                }
            },
            store: strTimePoint,
            valueField: 'displayTimepoint',
            width: fieldWidth
        });

         cbGenes = new Ext.ux.form.SuperBoxSelect({
            allowBlank: false,
            disabled: true,
            displayField: 'gene_symbol',
            fieldLabel: 'Genes',
            getParams: function(q){
                var params = {},
                    paramNames = this.store.paramNames;
                if ( this.pageSize ){
                    params[ paramNames.start ] = 0;
                    params[ paramNames.limit ] = this.pageSize;
                }

                strGene.setUserFilters([
                    LABKEY.Filter.create(
                        'gene_symbol',
                        q,
                        LABKEY.Filter.Types.CONTAINS
                    )
                ]);

                return params;
            },
            lazyInit: false,
            listeners: {
                additem:    checkBtnPlotStatus,
                clear:      checkBtnPlotStatus,
                removeItem: checkBtnPlotStatus,
                focus: function (){
                    if ( this.disabled ) {
                        return;
                    }
                    if ( this.isExpanded() ) {
                        this.multiSelectMode = false;
                    } else if ( this.pinList ) {
                        this.multiSelectMode = true;
                    }

                    this.initList();
                    if( this.triggerAction == 'all' ) {
                        this.doQuery( this.allQuery, true );
                    } else {
                        this.doQuery( this.getRawValue() );
                    }
                }
            },
            mode: 'remote',
            pageSize: 10,
            store: strGene,
            triggerAction: 'query',
            valueField: 'gene_symbol',
            width: fieldWidth
        });

        var cbShape = new Ext.ux.form.ExtendedComboBox({
            displayField: 'name',
            fieldLabel: 'Shape',
            lazyInit: false,
            store: strShape,
            valueField: 'name',
            width: fieldWidth
        });

        var cbColor = new Ext.ux.form.ExtendedComboBox({
            displayField: 'name',
            fieldLabel: 'Color',
            lazyInit: false,
            store: strDemographics,
            value: 'Age',
            valueField: 'name',
            width: fieldWidth
        });

        var cbSize = new Ext.ux.form.ExtendedComboBox({
            displayField: 'name',
            fieldLabel: 'Size',
            lazyInit: false,
            store: strDemographics,
            valueField: 'name',
            width: fieldWidth
        });

        var cbAlpha = new Ext.ux.form.ExtendedComboBox({
            displayField: 'name',
            fieldLabel: 'Alpha',
            lazyInit: false,
            store: strDemographics,
            valueField: 'name',
            width: fieldWidth
        });


        ///////////////////////////////////////
        // Buttons, Radio Groups, Checkboxes //
        ///////////////////////////////////////

        var chNormalize = new Ext.form.Checkbox({
            fieldLabel: 'Normalize to baseline'
        });

        var btnPlot = new Ext.Button({
            disabled: true,
            handler: function(){
                var width = Math.min( cntPlot.getWidth(), 800 );

                cnfPlot.inputParams = {
                    response:           cbResponse.getValue(),
                    cohorts:            Ext.encode( cbCohorts.getCheckedArray() ),
                    timePoint:          cbTimePoint.getSelectedField( 'timepoint' ),
                    timePointUnit:      cbTimePoint.getSelectedField( 'timepointUnit' ),
                    normalize:          chNormalize.getValue(),
                    genes:              Ext.encode( cbGenes.getValuesAsArray() ),
                    textSize:           spnrTextSize.getValue(),
                    facet:              rgFacet.getValue().getGroupValue(),
                    shape:              cbShape.getValue(),
                    color:              cbColor.getValue(),
                    size:               cbSize.getValue(),
                    alpha:              cbAlpha.getValue(),
                    imageWidth:         width,
                    imageHeight:        width
                };

                setPlotRunning( true );
                cnfPlot.reportSessionId = reportSessionId;
                LABKEY.Report.execute( cnfPlot );
            },
            text: 'Plot'
        });


        var spnrTextSize = new Ext.ux.form.SpinnerField({
            allowBlank: false,
            allowDecimals: false,
            fieldLabel: 'Text size',
            listeners: {
                invalid:    function(){ btnPlot.setDisabled( true ); },
                valid:      checkBtnPlotStatus
            },
            maxValue: 30,
            minValue: 0,
            value: 18,
            width: 40
        });

        var rgFacet = new Ext.form.RadioGroup({
            columns: [ 100, 100 ],
            fieldLabel: 'Facet',
            items: [
                {
                    boxLabel: 'Grid',
                    checked: true,
                    inputValue: 'Grid',
                    name: 'facet',
                    value: 'Grid'
                },
                {
                    boxLabel: 'Wrap',
                    inputValue: 'Wrap',
                    name: 'facet',
                    value: 'Wrap'
                }
            ]
        });


        /////////////////////////////////////
        //      Back-end Configuration     //
        /////////////////////////////////////

        var resizableImage;

        var cnfPlot = {
            failure: function( errorInfo, options, responseObj ){
                setPlotRunning( false );

                LABKEY.ext.ISCore.onFailure( errorInfo, options, responseObj );
            },
            reportId: 'module:GeneExpressionExplorer/Plot.R',
            success: function( result ){
                setPlotRunning( false );

                var errors = result.errors;
                var outputParams = result.outputParams;

                if (errors && errors.length > 0){
                    if ( errors[0].indexOf('The report session is invalid') < 0 ){

                        LABKEY.ext.ISCore.onFailure({
                            exception: errors.join('\n')
                        });
                    } else {
                        LABKEY.Report.createSession({
                            clientContext : 'GeneExpressionExplorer',
                            failure: LABKEY.ext.ISCore.onFailure,
                            success: function(data){
                                reportSessionId = data.reportSessionId;

                                setPlotRunning( true );
                                cnfPlot.reportSessionId = reportSessionId;
                                LABKEY.Report.execute( cnfPlot );
                            }
                        });
                    }
                } else {
                    var p = outputParams[0];

                    if ( p && p.type == 'image' ){
                        var imgId = 'img' + config.webPartDivId;
                        cntPlot.update( '<img id=\'' + imgId + '\' src=\'' + p.value + '\' >' );

                        var width = Math.min( cntPlot.getWidth(), 800 );

                        resizableImage = new Ext.Resizable( imgId, {
                            handles: ' ',
                            height: width,
                            preserveRatio: true,
                            width: width,
                            wrap: true
                        });

                        me.resizableImage = resizableImage;

                        // FancyBox plug in usage
                        $('#' + imgId).wrap('<a class=\'fancybox\' data-fancybox-type=\'image\' href=\'' + p.value + '\' />');

                        Ext.QuickTips.register({
                            target: imgId,
                            text: 'Click on the generated plot to see it in full screen'
                        });
                    }
                }
            }
        };


        /////////////////////////////////////
        //  Panels, Containers, Components //
        /////////////////////////////////////

        var cntPlot = new Ext.Container({
            border: false,
            html: '<div style=\'height: 10px\'></div>'
        });

        var tlbrPlot = new Ext.Toolbar({
            border: true,
            defaults: {
                style: 'padding-top: 1px; padding-bottom: 1px;'
            },
            //disabled: true,
            enableOverflow: true,
            items: [
                btnPlot,
                new Ext.Button({
                    handler: function(){
                        cbTimePoint.reset();
                        cbCohorts.reset();
                        chNormalize.reset();
                        cbGenes.reset(); //TODO: This shouldn't open the dropdown
                        cbShape.reset();
                        cbColor.reset();
                        cbSize.reset();
                        cbAlpha.reset();
                        checkBtnPlotStatus();
                    },
                    text: 'Reset'
                })
            ],
            style: 'padding-right: 2px; padding-left: 2px;'
        });

        var cfGenes = new Ext.form.CompositeField({
            items: [
                cbGenes,
                {
                    border: false,
                    html: LABKEY.ext.ISCore.helpTooltip( 'Genes', genes_help )
                }
            ]
        });

        var pnlInputView = new Ext.form.FormPanel({
            autoScroll: true,
            defaults: {
                autoHeight: true,
                forceLayout: true,
                hideMode: 'offsets'
            },
            deferredRender: false,
            items: [
                new Ext.Container({
                    autoEl: 'a',
                    cls: 'labkey-text-link bold-text',
                    html: 'quick help',
                    listeners: {
                        afterrender: {
                            fn: function(){
                                this.getEl().on( 'click', function(){ LABKEY.help.Tour.show('immport-gee-tour'); } );
                            },
                            single: true
                        }
                    }
                }),
                {
                    bodyStyle: 'padding-top: 10px;',
                    border: false,
                    defaults: {
                        border: false
                    },
                    items: [
                        { html: 'For information and help on how to use the Gene Expression Explorer module, click the' },
                        new Ext.Container({
                            autoEl: 'a',
                            html: '&nbsp;\'About\'&nbsp;',
                            listeners: {
                                afterrender: {
                                    fn: function(){
                                        this.getEl().on( 'click', function(){ pnlTabs.setActiveTab( 1 ); } );
                                    },
                                    single: true
                                }
                            }
                        }),
                        { html: 'and</br></br>' },
                        new Ext.Container({
                            autoEl: 'a',
                            html: '&nbsp;\'Help\'&nbsp;',
                            listeners: {
                                afterrender: {
                                    fn: function(){
                                        this.getEl().on( 'click', function(){ pnlTabs.setActiveTab( 2 ); } );
                                    },
                                    single: true
                                }
                            }
                        }),
                        { html: 'tabs above.' }
                    ],
                    layout: 'hbox'
                },
                new Ext.form.FieldSet({
                    autoScroll: true,
                    items: [
                        new Ext.form.CompositeField({
                            items: [
                                cbResponse,
                                {
                                    border: false,
                                    html: LABKEY.ext.ISCore.helpTooltip( 'Response', response_help )
                                }
                            ]
                        }),
                        new Ext.Spacer({
                            height: 20,
                            html: '&nbsp'
                        }),
                        new Ext.form.CompositeField({
                            items: [
                                cbTimePoint,
                                {
                                    border: false,
                                    html: LABKEY.ext.ISCore.helpTooltip( 'Time point', timepoint_help )
                                }
                            ]
                        }),
                        new Ext.form.CompositeField({
                            items: [
                                cbCohorts,
                                {
                                    border: false,
                                    html: LABKEY.ext.ISCore.helpTooltip( 'Cohorts', cohort_help )
                                }
                            ]
                        }),
                        new Ext.form.CompositeField({
                            items: [
                                chNormalize,
                                {
                                    border: false,
                                    html: LABKEY.ext.ISCore.helpTooltip( 'Normalize to baseline', normalize_help )
                                }
                            ]
                        }),
                        cfGenes
                    ],
                    labelWidth: labelWidth,
                    title: 'Parameters'
                }),
                new Ext.form.FieldSet({
                    autoScroll: true,
                    collapsed: true,
                    collapsible: true,
                    items: [
                        new Ext.form.CompositeField({
                            items: [
                                spnrTextSize,
                                {
                                    border: false,
                                    html: LABKEY.ext.ISCore.helpTooltip( 'Text size', textsize_help )
                                }
                            ]
                        }),
                        new Ext.form.CompositeField({
                            items: [
                                rgFacet,
                                {
                                    border: false,
                                    html: LABKEY.ext.ISCore.helpTooltip( 'Facet', facet_help )
                                }
                            ]
                        }),
                        cbShape,
                        cbColor,
                        cbSize,
                        cbAlpha
                    ],
                    labelWidth: labelWidth,
                    title: 'Additional options',
                    titleCollapse: true
                }),
                new Ext.Panel({
                    border: true,
                    items: [
                        tlbrPlot,
                        cntPlot
                    ],
                    style: 'padding-right: 2px; padding-left: 2px;'
                })
            ],
            tabTip: 'Input / View',
            title: 'Input / View'
        });

        var pnlTabs = new Ext.TabPanel({
            activeTab: 0,
            autoHeight: true,
            defaults: {
                autoHeight: true,
                bodyStyle: 'padding: 4px;',
                border: false,
                forceLayout: true,
                hideMode: 'offsets',
                style: 'padding-bottom: 4px; padding-right: 4px; padding-left: 4px;'
            },
            deferredRender: false,
            forceLayout: true,
            items: [
                pnlInputView,
                new Ext.Panel({
                    defaults: {
                        autoHeight: true,
                        bodyStyle: 'padding-bottom: 1px;',
                        hideMode: 'offsets'
                    },
                    items: [],
                    layout: 'fit',
                    tabTip: 'Data',
                    title: 'Data'
                }),
                new Ext.Panel({
                    defaults: {
                        autoHeight: true,
                        bodyStyle: 'padding-bottom: 1px;',
                        hideMode: 'offsets'
                    },
                    items: [
                        new Ext.form.Label(),
                        new Ext.form.FieldSet({
                            html: 'This module can be used to quickly plot the expression level of one or more genes against a selected immunological response variable (currently limited to HAI) in one or more cohorts.</br>Demographics variables such as gender and age can be added to the plot using aesthetic variables such as color, shape, etc.',
                            style: 'margin-top: 5px;',
                            title: 'Description'
                        }),
                        new Ext.form.FieldSet({
                            html: 'Visualization is achieved using the <a href="http://cran.r-project.org/web/packages/ggplot2/index.html" target="_blank">ggplot2</a> R package.',
                            style: 'margin-top: 5px;',
                            title: 'Details'
                        }),
                        new Ext.form.FieldSet({
                            html: LABKEY.ext.ISCore.contributors,
                            style: 'margin-bottom: 2px; margin-top: 5px;',
                            title: 'Contributors'
                        })
                    ],
                    layout: 'fit',
                    tabTip: 'About',
                    title: 'About'
                }),
                new Ext.Panel({
                    defaults: {
                        autoHeight: true,
                        bodyStyle: 'padding-bottom: 1px;',
                        hideMode: 'offsets'
                    },
                    items: [
                        new Ext.form.Label({
                            text: 'The following parameters are required to generate the plot. Note that the valid inputs are dynamically generated and always depends on the data. Some cohorts might not have gene-expression data and some might not be available at all timepoints.'
                        }),
                        new Ext.form.FieldSet({
                            html: '<b>Response:</b> '  + response_help + '<br><br>' + 
                              '<b>Time point:</b> ' + timepoint_help + '<br><br>' +
                              '<b>Cohorts:</b> ' + cohort_help + '<br><br>' +
                              '<b>Normalize to baseline:</b> ' + normalize_help + '<br><br>' +
                              '<b>Genes:</b> ' + genes_help,
                              style: 'margin-top: 5px;',
                            title: 'Parameters'
                        }),
                        new Ext.form.Label({
                            text: 'Parameters in the "Additional options" section can be used to customize the plot and modify it based on the demographic data. Available choices are Age, Gender, and Race.'
                        }),
                        new Ext.form.FieldSet({
                            html: '<b>Text size:</b> ' + textsize_help + '<br><br>' +
                                '<b>Facet:</b> ' + facet_help + '<br><br>' +
                                '<b>Shape:</b> ' + shape_help + '<br><br>' +
                                '<b>Color:</b> ' + color_help + '<br><br>' +
                                '<b>Size:</b> ' + size_help + '<br><br>' +
                                '<b>Alpha:</b> ' + alpha_help,
                            style: 'margin-bottom: 2px; margin-top: 5px;',
                            title: 'Additional options'
                        })
                    ],
                    layout: 'fit',
                    tabTip: 'Help',
                    title: 'Help'
                })
            ],
            layoutOnTabChange: true,
            listeners: {
                afterrender: {
                    fn: function(){
                        maskPlot = new Ext.LoadMask(
                            this.getEl(),
                            {
                                msg: LABKEY.ext.ISCore.generatingMessage,
                                msgCls: 'mask-loading'
                            }
                        );
                    },   
                    single: true 
                }
            },
            minTabWidth: 100,
            resizeTabs: true
        });


        /////////////////////////////////////
        //             Functions           //
        /////////////////////////////////////
        
        var handleTimepointSelection = function(){
            cbCohorts.clearValue( true );
            if ( cbTimePoint.getSelectedField( 'timepoint' ) <= 0){
                chNormalize.setDisabled( true );
                chNormalize.setValue( false );
            } else{
                chNormalize.setDisabled( false );
            }
            if ( cbTimePoint.getValue == '' ){
                cbCohorts.setDisabled( true );
            } else {
                strCohort.setUserFilters([
                    LABKEY.Filter.create(
                        'timepoint',
                        cbTimePoint.getSelectedField( 'timepoint' ),
                        LABKEY.Filter.Types.EQUAL
                    ),
                    LABKEY.Filter.create(
                        'timepointUnit',
                        cbTimePoint.getSelectedField( 'timepointUnit' ),
                        LABKEY.Filter.Types.EQUAL
                    )
                ]);
                strCohort.load();
            }
            checkBtnPlotStatus();
        };

        var setPlotRunning = function( bool ){
            if ( bool ){
                maskPlot.show();
            } else {
                maskPlot.hide();
            }
            btnPlot.setDisabled( bool );
            cbResponse.setDisabled( bool );
            cbCohorts.setDisabled( bool );
            cbTimePoint.setDisabled( bool );
            cbGenes.setDisabled( bool );
        };


        $('#' + config.webPartDivId)
            .parents('tr')
            .prev()
            .find('.labkey-wp-title-text')
            .wrap(
                '<a href=\'' +
                LABKEY.ActionURL.buildURL(
                    'reports',
                    'runReport',
                    null,
                    {
                        reportId: 'module:GeneExpressionExplorer/reports/schemas/Plot.R',
                        tabId: 'Source'
                    }
                ) +
                '\' target=\'_blank\' title=\'Click to open the R source code in a new window\'></a>'
            );

        // jQuery-related

        jQuery('.fancybox').fancybox({
            closeBtn: false,
            helpers: {
                buttons: {
                    tpl:
                        '<div id=\'fancybox-buttons\'>' +
                            '<ul>' +
                                '<li>' +
                                    '<a class=\'btnToggle\' title=\'Toggle size\' href=\'javascript:;\'></a>' +
                                '</li>' +
                                '<li>' +
                                    '<a class=\'btnClose\' title=\'Close\' href=\'javascript:jQuery.fancybox.close();\'></a>' +
                                '</li>' +
                            '</ul>' +
                        '</div>'
                }
            },
            type: 'image'
        });


        this.border         = false;
        this.boxMinWidth    = 370;
        this.cls            = 'ISCore';
        this.frame          = false;
        this.items          = pnlTabs;
        this.layout         = 'fit';
        this.renderTo       = config.webPartDivId;
        this.webPartDivId   = config.webPartDivId;
        this.width          = document.getElementById(config.webPartDivId).offsetWidth;

        this.cntPlot = cntPlot;

        LABKEY.ext.GeneExpressionExplorer.superclass.constructor.apply(this, arguments);

    }, // end constructor

    listeners: {
        afterrender: GEETour
    },   

    resize : function(){
        if ( this.resizableImage != undefined ){
            var width = Math.min( this.cntPlot.getWidth(), 800 );
            this.resizableImage.resizeTo( width, width * this.resizableImage.height / this.resizableImage.width );
        }
    }}); // end GeneExpressionExplorer Panel class

