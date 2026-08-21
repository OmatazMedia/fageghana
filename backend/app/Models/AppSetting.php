<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AppSetting extends Model
{
    protected $table = 'app_settings';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['singleton', 'site_name', 'site_url', 'currency', 'timezone', 'logo_url', 'primary_color'];


    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = \Illuminate\Support\Str::uuid()->toString();
            }
        });
    }
}
